from django.urls import path
from .views import (
    chat,
    stream_chat,
    get_conversations,
    get_messages,
    upload_file,
    delete_conversation,
    get_documents,
    delete_document,
    image_models,
    generate_image,
    image_history,
    delete_image_history_item,
)

urlpatterns = [
    path("chat/", chat),
    path("chat/stream/", stream_chat),
    path("image/models/", image_models),
    path("image/generate/", generate_image),
    path("image/history/", image_history),
    path("image/history/<int:image_id>/delete/", delete_image_history_item),
    path("upload/", upload_file),
    path("conversations/", get_conversations),
    path("messages/<int:conversation_id>/", get_messages),
    path("conversation/<int:conversation_id>/delete/", delete_conversation),
    path("documents/", get_documents),
    path("documents/<int:doc_id>/delete/", delete_document),
]