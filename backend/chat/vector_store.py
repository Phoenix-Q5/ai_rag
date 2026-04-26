from pathlib import Path
import hashlib
import sqlite3
import threading

from django.conf import settings
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS

try:
    from langchain_core.documents import Document
except Exception:
    class Document:  # pragma: no cover - fallback for missing langchain_core
        def __init__(self, page_content="", metadata=None):
            self.page_content = page_content
            self.metadata = metadata or {}


class CachedEmbeddings:
    def __init__(self, base_embeddings, cache_path):
        self.base = base_embeddings
        self.cache_path = Path(cache_path)
        self._lock = threading.Lock()
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(self.cache_path) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS embedding_cache (
                    cache_key TEXT PRIMARY KEY,
                    text_value TEXT NOT NULL,
                    vector_json TEXT NOT NULL
                )
                """
            )
            conn.commit()

    def _key(self, text):
        return hashlib.sha256((text or "").encode("utf-8")).hexdigest()

    def _get(self, text):
        cache_key = self._key(text)
        with self._lock, sqlite3.connect(self.cache_path) as conn:
            row = conn.execute(
                "SELECT vector_json FROM embedding_cache WHERE cache_key = ?",
                (cache_key,),
            ).fetchone()
        if not row:
            return None
        return [float(v) for v in row[0].split(",")]

    def _set(self, text, vector):
        cache_key = self._key(text)
        vector_json = ",".join(str(v) for v in vector)
        with self._lock, sqlite3.connect(self.cache_path) as conn:
            conn.execute(
                """
                INSERT INTO embedding_cache (cache_key, text_value, vector_json)
                VALUES (?, ?, ?)
                ON CONFLICT(cache_key) DO UPDATE SET vector_json=excluded.vector_json
                """,
                (cache_key, text or "", vector_json),
            )
            conn.commit()

    def embed_query(self, text):
        cached = self._get(text)
        if cached is not None:
            return cached
        vector = self.base.embed_query(text)
        self._set(text, vector)
        return vector

    def embed_documents(self, texts):
        results = [None] * len(texts)
        misses = []
        miss_indexes = []
        for idx, text in enumerate(texts):
            cached = self._get(text)
            if cached is not None:
                results[idx] = cached
            else:
                misses.append(text)
                miss_indexes.append(idx)

        if misses:
            fresh_vectors = self.base.embed_documents(misses)
            for i, vector in enumerate(fresh_vectors):
                original_idx = miss_indexes[i]
                text = misses[i]
                results[original_idx] = vector
                self._set(text, vector)
        return results


class FaissBackend:
    def __init__(self, embeddings):
        self.embeddings = embeddings
        self.base_path = Path(settings.BASE_DIR) / "faiss_index"
        self.base_path.mkdir(parents=True, exist_ok=True)

    def _user_path(self, user_id):
        path = self.base_path / f"user_{user_id}"
        path.mkdir(parents=True, exist_ok=True)
        return path

    def _load_user_db(self, user_id):
        user_path = self._user_path(user_id)
        if not (user_path / "index.faiss").exists():
            return None
        return FAISS.load_local(
            str(user_path),
            self.embeddings,
            allow_dangerous_deserialization=True,
        )

    def add_documents(self, user_id, documents):
        user_path = self._user_path(user_id)
        db = self._load_user_db(user_id)
        if db:
            db.add_documents(documents)
        else:
            db = FAISS.from_documents(documents, self.embeddings)
        db.save_local(str(user_path))

    def vector_search(self, user_id, query, k=20, use_mmr=True):
        db = self._load_user_db(user_id)
        if not db:
            return []
        if use_mmr:
            try:
                return db.max_marginal_relevance_search(query, k=k)
            except Exception:
                pass
        return db.similarity_search(query, k=k)

    def keyword_documents(self, user_id):
        db = self._load_user_db(user_id)
        if not db:
            return []
        docstore_dict = getattr(getattr(db, "docstore", None), "_dict", {})
        if not isinstance(docstore_dict, dict):
            return []
        return list(docstore_dict.values())


class QdrantBackend:
    def __init__(self, embeddings):
        self.embeddings = embeddings
        self._ready = False
        self.collection_prefix = getattr(settings, "QDRANT_COLLECTION_PREFIX", "phoenix_user_")
        try:
            from qdrant_client import QdrantClient
            from qdrant_client.models import Distance, PointStruct, VectorParams

            self.QdrantClient = QdrantClient
            self.Distance = Distance
            self.PointStruct = PointStruct
            self.VectorParams = VectorParams
            self.client = QdrantClient(
                url=getattr(settings, "QDRANT_URL", None) or None,
                api_key=getattr(settings, "QDRANT_API_KEY", None) or None,
            )
            self._ready = True
        except Exception as exc:
            self._init_error = exc
            print(f"Qdrant init failed, falling back is recommended: {exc}")

    def _collection(self, user_id):
        return f"{self.collection_prefix}{user_id}"

    def _ensure_collection(self, user_id):
        if not self._ready:
            return False
        collection = self._collection(user_id)
        vector_size = len(self.embeddings.embed_query("healthcheck"))
        try:
            self.client.get_collection(collection)
        except Exception:
            self.client.recreate_collection(
                collection_name=collection,
                vectors_config=self.VectorParams(size=vector_size, distance=self.Distance.COSINE),
            )
        return True

    def add_documents(self, user_id, documents):
        if not self._ensure_collection(user_id):
            raise RuntimeError("Qdrant backend not available")
        collection = self._collection(user_id)
        contents = [doc.page_content for doc in documents]
        vectors = self.embeddings.embed_documents(contents)
        points = []
        for idx, (doc, vector) in enumerate(zip(documents, vectors)):
            doc_id = int(hashlib.sha256(f"{doc.page_content}:{idx}".encode("utf-8")).hexdigest()[:16], 16)
            points.append(
                self.PointStruct(
                    id=doc_id,
                    vector=vector,
                    payload={
                        "page_content": doc.page_content,
                        "metadata": doc.metadata or {},
                    },
                )
            )
        self.client.upsert(collection_name=collection, points=points, wait=True)

    def vector_search(self, user_id, query, k=20, use_mmr=True):
        if not self._ready:
            return []
        collection = self._collection(user_id)
        query_vector = self.embeddings.embed_query(query)
        try:
            hits = self.client.search(
                collection_name=collection,
                query_vector=query_vector,
                limit=k,
                with_payload=True,
            )
        except Exception:
            return []
        docs = []
        for hit in hits:
            payload = hit.payload or {}
            docs.append(
                Document(
                    page_content=payload.get("page_content", ""),
                    metadata=payload.get("metadata", {}),
                )
            )
        return docs

    def keyword_documents(self, user_id):
        # For Qdrant, keyword retrieval is deferred to vector hits.
        return []


class VectorStoreService:
    def __init__(self):
        self.backend_name = (getattr(settings, "VECTOR_BACKEND", "faiss") or "faiss").lower()
        self._embeddings = None
        self._faiss = None
        self._qdrant = None

    @property
    def embeddings(self):
        if self._embeddings is None:
            base_embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
            cache_path = Path(settings.BASE_DIR) / "faiss_index" / "embedding_cache.sqlite3"
            self._embeddings = CachedEmbeddings(base_embeddings, cache_path)
        return self._embeddings

    @property
    def faiss(self):
        if self._faiss is None:
            self._faiss = FaissBackend(self.embeddings)
        return self._faiss

    @property
    def qdrant(self):
        if self._qdrant is None:
            self._qdrant = QdrantBackend(self.embeddings)
        return self._qdrant

    @property
    def backend(self):
        if self.backend_name == "qdrant" and self.qdrant._ready:
            return self.qdrant
        return self.faiss

    def add_documents(self, user_id, documents):
        return self.backend.add_documents(user_id, documents)

    def vector_search(self, user_id, query, k=20, use_mmr=True):
        return self.backend.vector_search(user_id, query, k=k, use_mmr=use_mmr)

    def keyword_documents(self, user_id):
        return self.backend.keyword_documents(user_id)


vector_store = VectorStoreService()
