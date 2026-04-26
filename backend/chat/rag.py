import re
from langchain_community.llms import Ollama
from .vector_store import vector_store
llm = Ollama(model="llama3")


def _tokenize(text):
    return [tok for tok in re.findall(r"\w+", (text or "").lower()) if tok]


def _keyword_rank_documents(corpus_docs, query, k=20):
    query_tokens = set(_tokenize(query))
    if not query_tokens:
        return []

    scored_docs = []
    for doc in corpus_docs:
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


def _fuse_ranked_lists(ranked_lists, top_k=5, rrf_k=60):
    rrf_scores = {}
    docs_map = {}
    for ranked_docs in ranked_lists:
        for rank, doc in enumerate(ranked_docs, start=1):
            doc_id = _doc_id(doc)
            rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + 1.0 / (rrf_k + rank)
            docs_map[doc_id] = doc
    ranked_ids = sorted(rrf_scores, key=lambda doc_id: rrf_scores[doc_id], reverse=True)
    return [docs_map[doc_id] for doc_id in ranked_ids[:top_k]]


def _rewrite_query(query):
    prompt = f"""
    Rewrite this user query for semantic retrieval.
    Keep meaning identical and output only one line.
    Query: {query}
    """
    try:
        rewritten = llm.invoke(prompt).strip().replace("\n", " ")
        rewritten = " ".join(rewritten.split())
        return rewritten or query
    except Exception:
        return query


def _generate_multi_queries(query, rewritten_query, max_queries=3):
    prompt = f"""
    Generate {max_queries} alternative search queries for retrieval.
    Preserve intent. Return one query per line, no numbering.
    Original: {query}
    Rewritten: {rewritten_query}
    """
    try:
        raw = llm.invoke(prompt)
        candidates = []
        for line in raw.splitlines():
            q = re.sub(r"^\s*[\-\d\.\)]*\s*", "", line).strip()
            if q:
                candidates.append(q)
        if candidates:
            return candidates[:max_queries]
    except Exception:
        pass
    return []


def _retrieve_docs_for_query(user_id, query, candidate_k=20, top_k=8):
    vector_docs = vector_store.vector_search(user_id, query, k=candidate_k, use_mmr=True)
    keyword_docs = _keyword_rank_documents(
        vector_store.keyword_documents(user_id),
        query,
        k=candidate_k,
    )
    docs = _fuse_with_rrf(vector_docs, keyword_docs, top_k=top_k)
    return docs or vector_docs[:top_k]


def _retrieve_docs(query, user_id=None):
    rewritten = _rewrite_query(query)
    multi_queries = _generate_multi_queries(query, rewritten, max_queries=3)
    retrieval_queries = [query, rewritten, *multi_queries]
    deduped_queries = []
    seen = set()
    for q in retrieval_queries:
        key = q.strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        deduped_queries.append(q.strip())

    ranked_lists = [
        _retrieve_docs_for_query(user_id, retrieval_query)
        for retrieval_query in deduped_queries
    ]
    docs = _fuse_ranked_lists(ranked_lists, top_k=5)
    if docs:
        return docs
    return _retrieve_docs_for_query(user_id, query, top_k=5)


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