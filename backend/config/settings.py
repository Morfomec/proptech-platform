"""
Django settings for PropTech Platform.
"""

from datetime import timedelta
from pathlib import Path

import environ


# ============================================================
# BASE DIRECTORY & ENVIRONMENT
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DJANGO_DEBUG=(bool, False),
)

environ.Env.read_env(BASE_DIR / ".env")


# ============================================================
# CORE SETTINGS
# ============================================================

SECRET_KEY = env("DJANGO_SECRET_KEY")

DEBUG = env.bool("DJANGO_DEBUG", default=False)

ALLOWED_HOSTS = env.list(
    "DJANGO_ALLOWED_HOSTS",
    default=["localhost", "127.0.0.1"],
)


# ============================================================
# APPLICATIONS
# ============================================================

INSTALLED_APPS = [
    # Django
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.postgres",

    # Third-party
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "drf_spectacular",

    # Local applications
    "apps.accounts.apps.AccountsConfig",
    "apps.core.apps.CoreConfig",
    "apps.properties.apps.PropertiesConfig",
    "apps.listings.apps.ListingsConfig",
    "apps.leasing.apps.LeasingConfig",
    "apps.documents.apps.DocumentsConfig",
    "apps.notifications.apps.NotificationsConfig",
]


# ============================================================
# MIDDLEWARE
# ============================================================

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]


# ============================================================
# URL & APPLICATION CONFIGURATION
# ============================================================

ROOT_URLCONF = "config.urls"

WSGI_APPLICATION = "config.wsgi.application"

ASGI_APPLICATION = "config.asgi.application"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# ============================================================
# TEMPLATES
# ============================================================

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]


# ============================================================
# AUTHENTICATION
# ============================================================

AUTH_USER_MODEL = "accounts.User"


# ============================================================
# DATABASE
# ============================================================

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("DB_NAME"),
        "USER": env("DB_USER"),
        "PASSWORD": env("DB_PASSWORD"),
        "HOST": env("DB_HOST", default="localhost"),
        "PORT": env.int("DB_PORT", default=5432),
        "CONN_MAX_AGE": 60,
        "CONN_HEALTH_CHECKS": True,
    }
}


# ============================================================
# PASSWORD VALIDATION
# ============================================================

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "UserAttributeSimilarityValidator"
        ),
    },
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "MinimumLengthValidator"
        ),
    },
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "CommonPasswordValidator"
        ),
    },
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "NumericPasswordValidator"
        ),
    },
]


# ============================================================
# DJANGO REST FRAMEWORK
# ============================================================

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],

    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],

    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",

    "DEFAULT_PAGINATION_CLASS": (
    "apps.core.pagination.StandardResultsSetPagination"
    ),
    "PAGE_SIZE": 20,

    "EXCEPTION_HANDLER": "apps.core.exceptions.custom_exception_handler",

    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.ScopedRateThrottle",
    ],

    "DEFAULT_THROTTLE_RATES": {
        "registration": env(
            "THROTTLE_RATE_REGISTRATION",
            default="5/minute",
        ),
        "email_verification": env(
            "THROTTLE_RATE_EMAIL_VERIFICATION",
            default="10/minute",
        ),
        "resend_email_verification": env(
            "THROTTLE_RATE_RESEND_VERIFICATION",
            default="3/hour",
        ),
        "password_reset_request": env(
            "THROTTLE_RATE_PASSWORD_RESET_REQUEST",
            default="3/hour",
        ),
        "login": env(
            "THROTTLE_RATE_LOGIN",
            default="10/minute",
        ),
        "google_auth": env(
            "THROTTLE_RATE_GOOGLE_AUTH",
            default="10/minute",
        ),
        "token_refresh": env(
            "THROTTLE_RATE_TOKEN_REFRESH",
            default="30/minute",
        ),
        "password_reset_confirm": env(
            "THROTTLE_RATE_PASSWORD_RESET_CONFIRM",
            default="5/minute",
        ),
    },
}


# ============================================================
# JWT AUTHENTICATION
# ============================================================

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=5),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": False,
}


# ============================================================
# API DOCUMENTATION
# ============================================================

SPECTACULAR_SETTINGS = {
    "TITLE": "PropTech Platform API",
    "DESCRIPTION": "API documentation for the PropTech Platform.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "ENUM_NAME_OVERRIDES": {
        "PropertyCategoryEnum": "apps.properties.models.property.PropertyCategory.choices",
        "AmenityCategoryEnum": "apps.properties.models.amenity.AmenityCategory.choices",
        "PropertyStatusEnum": "apps.properties.models.property.PropertyStatus.choices",
        "ListingStatusEnum": "apps.listings.models.listing.ListingStatus.choices",
        "ListingCreateStatusEnum": [
            ("draft", "draft"),
            ("published", "published"),
        ],
        "ApplicationStatusEnum": "apps.leasing.models.application.ApplicationStatus.choices",
        "ApplicationReviewStatusEnum": [
            ("under_review", "under_review"),
            ("approved", "approved"),
            ("rejected", "rejected"),
        ],
        "TenancyStatusEnum": "apps.leasing.models.tenancy.TenancyStatus.choices",
        "DocumentTypeEnum": (
            "apps.documents.models.document.DocumentType.choices"
        ),
        "DocumentStatusEnum": (
            "apps.documents.models.document.DocumentStatus.choices"
        ),
        "NotificationTypeEnum": "apps.notifications.models.NotificationType",
        "RelatedObjectTypeEnum": "apps.notifications.models.RelatedObjectType",
    },
}


# ============================================================
# CORS & FRONTEND
# ============================================================

CORS_ALLOWED_ORIGINS = env.list(
    "CORS_ALLOWED_ORIGINS",
    default=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
)

FRONTEND_URL = env(
    "FRONTEND_URL",
    default="http://localhost:5174" if DEBUG else "",
)

CSRF_TRUSTED_ORIGINS = env.list(
    "CSRF_TRUSTED_ORIGINS",
    default=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
)


# ============================================================
# INTERNATIONALIZATION
# ============================================================

LANGUAGE_CODE = "en-us"

TIME_ZONE = "UTC"

USE_I18N = True

USE_TZ = True


# ============================================================
# STATIC & MEDIA FILES
# ============================================================

STATIC_URL = "/static/"

STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"

MEDIA_ROOT = BASE_DIR / "media"

PRIVATE_MEDIA_ROOT = BASE_DIR / "private_media"

STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}


# ============================================================
# EMAIL
# ============================================================

EMAIL_BACKEND = (
    "django.core.mail.backends.console.EmailBackend"
)

DEFAULT_FROM_EMAIL = env(
    "DEFAULT_FROM_EMAIL",
    default="noreply@proptech.local",
)


# ============================================================
# SECURITY
# ============================================================

SECURE_SSL_REDIRECT = env.bool(
    "DJANGO_SECURE_SSL_REDIRECT",
    default=not DEBUG,
)

SESSION_COOKIE_SECURE = not DEBUG

CSRF_COOKIE_SECURE = not DEBUG

SECURE_CONTENT_TYPE_NOSNIFF = True

X_FRAME_OPTIONS = "DENY"

SECURE_HSTS_SECONDS = 0


# ============================================================
# GOOGLE OAUTH
# ============================================================

GOOGLE_CLIENT_ID = env(
    "GOOGLE_CLIENT_ID",
    default="",
)
