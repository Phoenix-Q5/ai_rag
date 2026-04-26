from django.contrib.auth.models import User
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import permission_classes
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.conf import settings
from django.core.mail import send_mail

@api_view(["POST"])
def signup(request):
    username = request.data.get("username")
    password = request.data.get("password")
    email = request.data.get("email")
    first_name = request.data.get("name")

    if User.objects.filter(username=username).exists():
        return Response({"error": "Username already exists"}, status=400)
    if email and User.objects.filter(email=email).exists():
        return Response({"error": "Email already exists"}, status=400)

    user = User.objects.create_user(
        username=username,
        password=password,
        email=email,
        first_name=first_name,
        is_active=False
    )

    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
    verify_url = f"{frontend_url}?uid={uid}&token={token}"

    email_sent = False
    try:
        send_mail(
            subject="Verify your Phoenix AI account",
            message=(
                f"Hi {first_name or username},\n\n"
                "Please verify your email by clicking the link below:\n"
                f"{verify_url}\n\n"
                "If you did not create this account, you can ignore this email."
            ),
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@phoenix-ai.local"),
            recipient_list=[email],
            fail_silently=False,
        )
        email_sent = True
    except Exception:
        email_sent = False

    return Response(
        {
            "message": "User created. Please verify your email before logging in.",
            "email_sent": email_sent,
            "verify_url": verify_url if not email_sent else None,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
def verify_email(request):
    uid = request.GET.get("uid")
    token = request.GET.get("token")
    if not uid or not token:
        return Response({"error": "Missing verification parameters"}, status=400)

    try:
        user_id = force_str(urlsafe_base64_decode(uid))
        user = User.objects.get(pk=user_id)
    except Exception:
        return Response({"error": "Invalid verification link"}, status=400)

    if not default_token_generator.check_token(user, token):
        return Response({"error": "Invalid or expired verification link"}, status=400)

    if not user.is_active:
        user.is_active = True
        user.save(update_fields=["is_active"])

    return Response({"message": "Email verified successfully"})

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_user(request):
    user = request.user

    return Response({
        "username": user.username,
        "name": user.first_name,
        "email": user.email
    })