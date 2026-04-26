from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenObtainPairView
from users.views import signup, get_user, verify_email

urlpatterns = [
    path("admin/", admin.site.urls),

    path("auth/login/", TokenObtainPairView.as_view()),
    path("auth/signup/", signup),
    path("auth/verify-email/", verify_email),
    path("auth/me/", get_user),
    path("", include("chat.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)