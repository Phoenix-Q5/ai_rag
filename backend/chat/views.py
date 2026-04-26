from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.http import StreamingHttpResponse
from django.db.models import Q
from .models import Conversation, Message, Document
from django.conf import settings
from pathlib import Path
from .serializers import ConversationSerializer
import time
from .rag import ask_rag, generate_chat_title
from langchain_community.document_loaders import TextLoader, PyPDFLoader
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def chat(request):
    user = request.user
    message = request.data.get("message")
    conversation_id = request.data.get("conversation_id")
    is_new_conversation = not conversation_id

    if conversation_id:
        conversation = Conversation.objects.get(id=conversation_id, user=user)
    else:
        conversation = Conversation.objects.create(
            user=user,
            title="New Chat"
        )

    Message.objects.create(
        conversation=conversation,
        role="user",
        content=message
    )

    ai_response = ask_rag(message)
    if is_new_conversation:
        conversation.title = generate_chat_title(message)
        conversation.save(update_fields=["title"])

    Message.objects.create(
        conversation=conversation,
        role="ai",
        content=ai_response
    )

    return Response({
        "conversation_id": conversation.id,
        "response": ai_response
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def stream_chat(request):
    user = request.user
    message = request.data.get("message")
    conversation_id = request.data.get("conversation_id")
    is_new_conversation = not conversation_id

    if conversation_id:
        conversation = Conversation.objects.get(id=conversation_id, user=user)
    else:
        conversation = Conversation.objects.create(
            user=user,
            title="New Chat"
        )

    Message.objects.create(
        conversation=conversation,
        role="user",
        content=message
    )

    def generate():
        full_text = ""

        try:
            response = ask_rag(message, request.user.id)
        except Exception as e:
            print("RAG ERROR:", str(e))
            response = "Sorry, something went wrong in AI processing."

        for char in response:
            full_text += char
            yield char

        Message.objects.create(
            conversation=conversation,
            role="ai",
            content=full_text
        )
        if is_new_conversation:
            conversation.title = generate_chat_title(message)
            conversation.save(update_fields=["title"])

    return StreamingHttpResponse(generate(), content_type="text/plain")


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_conversations(request):
    search_query = (request.GET.get("q") or "").strip()
    conversations = Conversation.objects.filter(user=request.user)
    if search_query:
        conversations = conversations.filter(
            Q(title__icontains=search_query) |
            Q(messages__content__icontains=search_query)
        ).distinct()
    conversations = conversations.order_by("-created_at")
    return Response(ConversationSerializer(conversations, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_messages(request, conversation_id):
    conversation = Conversation.objects.get(id=conversation_id, user=request.user)
    return Response(ConversationSerializer(conversation).data)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def upload_file(request):
    file = request.FILES.get("file")

    doc = Document.objects.create(
        user=request.user,
        file=file
    )

    file_path = doc.file.path

    # 🔹 Load file
    if file.name.endswith(".pdf"):
        loader = PyPDFLoader(file_path)
    else:
        loader = TextLoader(file_path)

    documents = loader.load()

    embeddings = HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2"
    )

    # 🔹 User FAISS path
    user_path = Path(settings.BASE_DIR) / "faiss_index" / f"user_{request.user.id}"
    user_path.mkdir(parents=True, exist_ok=True)

    # 🔹 Create or update index
    if (user_path / "index.faiss").exists():
        db = FAISS.load_local(
            str(user_path),
            embeddings,
            allow_dangerous_deserialization=True
        )
        db.add_documents(documents)
    else:
        db = FAISS.from_documents(documents, embeddings)

    db.save_local(str(user_path))

    return Response({"message": "File uploaded and indexed"})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_conversation(request, conversation_id):
    try:
        conv = Conversation.objects.get(id=conversation_id, user=request.user)
        conv.delete()
        return Response({"message": "Deleted"})
    except Conversation.DoesNotExist:
        return Response({"error": "Not found"}, status=404)
    

from .models import Document

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_documents(request):
    docs = Document.objects.filter(user=request.user)
    return Response([
        {"id": d.id, "name": d.file.name}
        for d in docs
    ])

@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_document(request, doc_id):
    try:
        doc = Document.objects.get(id=doc_id, user=request.user)
        doc.delete()
        return Response({"message": "Deleted"})
    except Document.DoesNotExist:
        return Response({"error": "Not found"}, status=404)