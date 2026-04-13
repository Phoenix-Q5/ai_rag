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

def ask_rag(query):
    docs = db.similarity_search(query)

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