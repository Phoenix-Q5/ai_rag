from rest_framework.decorators import api_view, permission_classes
from rest_framework.decorators import parser_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.http import StreamingHttpResponse
from django.db.models import Q
from .models import Conversation, Message, Document, GeneratedImage
from django.conf import settings
from .serializers import ConversationSerializer
from .rag import ask_rag, ask_rag_stream, generate_chat_title
from langchain_community.document_loaders import TextLoader, PyPDFLoader
from .vector_store import vector_store
from .image_generation import get_supported_image_models, generate_image as generate_image_with_model
import base64
from django.core.files.base import ContentFile
from uuid import uuid4

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

    ai_response = ask_rag(message, user.id)
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
        chunk_buffer = ""
        chunk_size = max(1, int(getattr(settings, "STREAM_CHUNK_SIZE", 32)))
        yield f"[CONV_ID]{conversation.id}[/CONV_ID]"

        try:
            stream_iter = ask_rag_stream(message, request.user.id)
        except Exception as e:
            print("RAG ERROR:", str(e))
            stream_iter = iter(["Sorry, something went wrong in AI processing."])

        for token in stream_iter:
            full_text += token
            chunk_buffer += token

            # Flush on semantic boundaries or when chunk gets large enough.
            if (
                len(chunk_buffer) >= chunk_size
                or chunk_buffer.endswith((" ", "\n"))
                or any(p in chunk_buffer[-1:] for p in [".", ",", "!", "?", ";", ":"])
            ):
                yield chunk_buffer
                chunk_buffer = ""

        if chunk_buffer:
            yield chunk_buffer

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

    vector_store.add_documents(request.user.id, documents)

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


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def image_models(request):
    models = get_supported_image_models()
    return Response({"models": models})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def image_history(request):
    try:
        page = max(1, int(request.GET.get("page", "1")))
    except ValueError:
        page = 1
    try:
        page_size = int(request.GET.get("page_size", "12"))
    except ValueError:
        page_size = 12
    page_size = max(1, min(page_size, 50))
    offset = (page - 1) * page_size

    queryset = GeneratedImage.objects.filter(user=request.user).order_by("-created_at")
    total = queryset.count()
    items = queryset[offset : offset + page_size]
    has_more = offset + page_size < total

    return Response(
        {
            "page": page,
            "page_size": page_size,
            "total": total,
            "has_more": has_more,
            "items": [
                {
                    "id": item.id,
                    "model": item.model,
                    "prompt": item.prompt,
                    "width": item.width,
                    "height": item.height,
                    "mime_type": item.mime_type,
                    "created_at": item.created_at,
                    "output_image_url": request.build_absolute_uri(item.output_image.url),
                    "input_image_url": request.build_absolute_uri(item.input_image.url)
                    if item.input_image
                    else None,
                }
                for item in items
            ]
        }
    )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_image_history_item(request, image_id):
    try:
        item = GeneratedImage.objects.get(id=image_id, user=request.user)
    except GeneratedImage.DoesNotExist:
        return Response({"error": "Not found"}, status=404)

    if item.output_image:
        item.output_image.delete(save=False)
    if item.input_image:
        item.input_image.delete(save=False)
    item.delete()
    return Response({"message": "Deleted"})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def generate_image(request):
    prompt = (request.data.get("prompt") or "").strip()
    model = (request.data.get("model") or "").strip()
    width = int(request.data.get("width") or 1024)
    height = int(request.data.get("height") or 1024)

    if not prompt:
        return Response({"error": "Prompt is required"}, status=400)
    if not model:
        return Response({"error": "Model is required"}, status=400)

    supported_models = get_supported_image_models()
    model_capabilities = {item["id"]: item for item in supported_models}
    if model not in model_capabilities:
        return Response({"error": "Selected model is not supported"}, status=400)

    input_image = None
    input_upload_for_save = None
    upload = request.FILES.get("image")
    if upload:
        input_upload_for_save = upload
        upload_bytes = upload.read()
        input_image = {
            "mime_type": upload.content_type or "image/png",
            "data": base64.b64encode(upload_bytes).decode("utf-8"),
        }

    if input_image and not model_capabilities[model].get("supports_edit", False):
        return Response(
            {"error": "Selected model does not support image editing"},
            status=400,
        )

    try:
        images = generate_image_with_model(
            prompt=prompt,
            model=model,
            width=width,
            height=height,
            input_image=input_image,
        )
    except Exception as exc:
        return Response({"error": str(exc)}, status=500)

    saved_images = []
    for idx, image in enumerate(images):
        raw_bytes = base64.b64decode(image["data"])
        extension = "png"
        if "jpeg" in image["mime_type"] or "jpg" in image["mime_type"]:
            extension = "jpg"

        generated = GeneratedImage.objects.create(
            user=request.user,
            model=model,
            prompt=prompt,
            width=width,
            height=height,
            mime_type=image["mime_type"],
        )
        generated.output_image.save(
            f"{request.user.id}_{uuid4().hex}_{idx}.{extension}",
            ContentFile(raw_bytes),
            save=True,
        )
        if input_upload_for_save:
            input_upload_for_save.seek(0)
            generated.input_image.save(
                f"{request.user.id}_{uuid4().hex}_input_{idx}.{input_upload_for_save.name.split('.')[-1]}",
                ContentFile(input_upload_for_save.read()),
                save=True,
            )

        saved_images.append(
            {
                "id": generated.id,
                "mime_type": image["mime_type"],
                "data": image["data"],
                "download_url": request.build_absolute_uri(generated.output_image.url),
            }
        )

    return Response({"images": saved_images})