from django.contrib.auth.models import User
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import permission_classes

@api_view(["POST"])
def signup(request):
    username = request.data.get("username")
    password = request.data.get("password")
    email = request.data.get("email")
    first_name = request.data.get("name")

    if User.objects.filter(username=username).exists():
        return Response({"error": "Username already exists"}, status=400)

    user = User.objects.create_user(
        username=username,
        password=password,
        email=email,
        first_name=first_name
    )

    return Response({"message": "User created successfully"})

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_user(request):
    user = request.user

    return Response({
        "username": user.username,
        "name": user.first_name,
        "email": user.email
    })