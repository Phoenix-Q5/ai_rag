from pathlib import Path
from langchain_community.llms import Ollama
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings

embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

llm = Ollama(model="llama3")

from pathlib import Path
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.llms import Ollama

# 📁 Base path
BASE_DIR = Path(__file__).resolve().parent.parent
FAISS_PATH = BASE_DIR / "faiss_index"

# 🔹 Initialize embeddings
embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

# 🔹 Load FAISS DB (THIS WAS MISSING)
db = FAISS.load_local(
    str(FAISS_PATH),
    embeddings,
    allow_dangerous_deserialization=True
)

llm = Ollama(model="llama3")

def get_user_db(user_id):
    path = BASE_DIR / "faiss_index" / f"user_{user_id}"

    if not path.exists():
        return None

    return FAISS.load_local(
        str(path),
        embeddings,
        allow_dangerous_deserialization=True
    )

def ask_rag(query, user_id=None):
    user_db = get_user_db(user_id) if user_id is not None else None
    active_db = user_db or db
    docs = active_db.similarity_search(query)

    context = "\n".join([doc.page_content for doc in docs])

    prompt = f"""
    Use the context below to answer the question.

    Context:
    {context}

    Question:
    {query}
    """

    response = llm.invoke(prompt)

    return response


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