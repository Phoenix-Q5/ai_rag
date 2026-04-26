from django.db import models
from django.contrib.auth.models import User

class Conversation(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Message(models.Model):
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name="messages"
    )
    role = models.CharField(max_length=10)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

class Document(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    file = models.FileField(upload_to="documents/")
    uploaded_at = models.DateTimeField(auto_now_add=True)


class GeneratedImage(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    model = models.CharField(max_length=120)
    prompt = models.TextField()
    width = models.IntegerField(default=1024)
    height = models.IntegerField(default=1024)
    input_image = models.FileField(upload_to="generated_images/input/", null=True, blank=True)
    output_image = models.FileField(upload_to="generated_images/output/")
    mime_type = models.CharField(max_length=64, default="image/png")
    created_at = models.DateTimeField(auto_now_add=True)