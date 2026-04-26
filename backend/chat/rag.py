from pathlib import Path
import re
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.llms import Ollama

BASE_DIR = Path(__file__).resolve().parent.parent
FAISS_PATH = BASE_DIR / "faiss_index"

embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
db = FAISS.load_local(
    str(FAISS_PATH),
    embeddings,
    allow_dangerous_deserialization=True,
)
llm = Ollama(model="llama3")


def get_user_db(user_id):
    path = BASE_DIR / "faiss_index" / f"user_{user_id}"
    if not path.exists():
        return None
    return FAISS.load_local(
        str(path),
        embeddings,
        allow_dangerous_deserialization=True,
    )


def _tokenize(text):
    return [tok for tok in re.findall(r"\w+", (text or "").lower()) if tok]


def _keyword_rank_documents(active_db, query, k=20):
    query_tokens = set(_tokenize(query))
    if not query_tokens:
        return []
    docstore_dict = getattr(getattr(active_db, "docstore", None), "_dict", {})
    if not isinstance(docstore_dict, dict):
        return []

    scored_docs = []
    for doc in docstore_dict.values():
        content = getattr(doc, "page_content", "")
        doc_tokens = set(_tokenize(content))
        if not doc_tokens:
            continue
        overlap = query_tokens.intersection(doc_tokens)
        if overlap:
            score = len(overlap) / (len(query_tokens) + 1e-9)
            scored_docs.append((score, doc))

    scored_docs.sort(key=lambda item: item[0], reverse=True)
    return [doc for _, doc in scored_docs[:k]]


def _doc_id(doc):
    metadata = getattr(doc, "metadata", {}) or {}
    return metadata.get("source") or str(hash(getattr(doc, "page_content", "")))


def _fuse_with_rrf(vector_docs, keyword_docs, top_k=5, rrf_k=60):
    rrf_scores = {}
    docs_map = {}
    for rank, doc in enumerate(vector_docs, start=1):
        doc_id = _doc_id(doc)
        rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + 1.0 / (rrf_k + rank)
        docs_map[doc_id] = doc
    for rank, doc in enumerate(keyword_docs, start=1):
        doc_id = _doc_id(doc)
        rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + 1.0 / (rrf_k + rank)
        docs_map[doc_id] = doc
    ranked_ids = sorted(rrf_scores, key=lambda doc_id: rrf_scores[doc_id], reverse=True)
    return [docs_map[doc_id] for doc_id in ranked_ids[:top_k]]


def _retrieve_docs(query, user_id=None):
    user_db = get_user_db(user_id) if user_id is not None else None
    active_db = user_db or db
    try:
        vector_docs = active_db.max_marginal_relevance_search(query, k=20)
    except Exception:
        vector_docs = active_db.similarity_search(query, k=20)
    keyword_docs = _keyword_rank_documents(active_db, query, k=20)
    docs = _fuse_with_rrf(vector_docs, keyword_docs, top_k=5)
    return docs or vector_docs[:5]


def _build_prompt(query, docs):
    context = "\n".join([doc.page_content for doc in docs])
    return f"""
    Use the context below to answer the question.

    Context:
    {context}

    Question:
    {query}
    """


def ask_rag(query, user_id=None):
    docs = _retrieve_docs(query, user_id=user_id)
    prompt = _build_prompt(query, docs)
    return llm.invoke(prompt)


def ask_rag_stream(query, user_id=None):
    docs = _retrieve_docs(query, user_id=user_id)
    prompt = _build_prompt(query, docs)
    try:
        for chunk in llm.stream(prompt):
            text = getattr(chunk, "text", chunk)
            if text:
                yield text
    except Exception:
        # Fallback to non-streaming invocation if stream is unavailable.
        response = llm.invoke(prompt)
        for char in response:
            yield char


def generate_chat_title(message):
    prompt = f"""
    Create a concise chat title (max 8 words) for this user query.
    Return only the title text with no quotes, markdown, or punctuation decorations.

    User query:
    {message}
    """
    try:
        title = llm.invoke(prompt).strip().replace("\n", " ")
        title = " ".join(title.split())
        if title:
            return title[:80]
    except Exception:
        pass
    words = message.strip().split()
    fallback = " ".join(words[:8]).strip()
    return fallback[:80] if fallback else "New Chat"