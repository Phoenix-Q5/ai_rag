from django.urls import path
from .views import chat, stream_chat, get_conversations, get_messages, upload_file, delete_conversation, get_documents, delete_document

urlpatterns = [
    path("chat/", chat),
    path("chat/stream/", stream_chat),
    path("upload/", upload_file),
    path("conversations/", get_conversations),
    path("messages/<int:conversation_id>/", get_messages),
    path("conversation/<int:conversation_id>/delete/", delete_conversation),
    path("documents/", get_documents),
path("documents/<int:doc_id>/delete/", delete_document),
]