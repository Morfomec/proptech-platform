"""
Django settings for PropTech Platform.
"""

from datetime import timedelta
from pathlib import Path

import environ
from django.templatetags.static import static
from django.urls import reverse_lazy
from django.utils.translation import gettext_lazy as _


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
    # Admin Interface (Unfold must precede django.contrib.admin)
    "unfold",
    "unfold.contrib.filters",
    "unfold.contrib.forms",
    "unfold.contrib.inlines",

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
    "apps.subscriptions.apps.SubscriptionsConfig",
    "apps.rent.apps.RentConfig",
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
        "ListingReviewStatusEnum": "apps.listings.models.listing.ReviewStatus.choices",
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
        "SubscriptionStatusEnum": "apps.subscriptions.models.subscription.SubscriptionStatus.choices",
        "SubscriptionPaymentStatusEnum": "apps.subscriptions.models.payment.SubscriptionPaymentStatus.choices",
        "SubscriptionPaymentMethodEnum": "apps.subscriptions.models.payment.SubscriptionPaymentMethod.choices",
        "RentChargeTypeEnum": "apps.rent.models.rent_charge.RentChargeType.choices",
        "RentChargeStatusEnum": "apps.rent.models.rent_charge.RentChargeStatus.choices",
        "PaymentMethodEnum": "apps.rent.models.payment.PaymentMethod.choices",
        "PaymentStatusEnum": "apps.rent.models.payment.PaymentStatus.choices",
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

TIME_ZONE = env("DJANGO_TIME_ZONE", default="Asia/Kolkata")

USE_I18N = True

USE_TZ = True


# ============================================================
# STATIC & MEDIA FILES
# ============================================================

STATIC_URL = "/static/"

STATIC_ROOT = BASE_DIR / "staticfiles"

STATICFILES_DIRS = [
    BASE_DIR / "static",
]

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

EMAIL_HOST = env("EMAIL_HOST", default="")
EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
EMAIL_USE_SSL = env.bool("EMAIL_USE_SSL", default=False)
EMAIL_TIMEOUT = env.int("EMAIL_TIMEOUT", default=10)

# Default to SMTP backend when EMAIL_HOST is configured, otherwise fallback to console backend for local dev
_DEFAULT_EMAIL_BACKEND = (
    "django.core.mail.backends.smtp.EmailBackend"
    if EMAIL_HOST
    else "django.core.mail.backends.console.EmailBackend"
)

EMAIL_BACKEND = env("EMAIL_BACKEND", default=_DEFAULT_EMAIL_BACKEND)

DEFAULT_FROM_EMAIL = env(
    "DEFAULT_FROM_EMAIL",
    default="noreply@domioo.in" if not DEBUG else "noreply@proptech.local",
)


# ============================================================
# SECURITY
# ============================================================

SECURE_SSL_REDIRECT = env.bool(
    "DJANGO_SECURE_SSL_REDIRECT",
    default=not DEBUG,
)

SESSION_COOKIE_SECURE = env.bool(
    "DJANGO_SESSION_COOKIE_SECURE",
    default=not DEBUG,
)

CSRF_COOKIE_SECURE = env.bool(
    "DJANGO_CSRF_COOKIE_SECURE",
    default=not DEBUG,
)

SECURE_CONTENT_TYPE_NOSNIFF = True

X_FRAME_OPTIONS = "DENY"

SECURE_HSTS_SECONDS = env.int(
    "DJANGO_SECURE_HSTS_SECONDS",
    default=31536000 if not DEBUG else 0,
)

SECURE_HSTS_INCLUDE_SUBDOMAINS = env.bool(
    "DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS",
    default=not DEBUG,
)

SECURE_HSTS_PRELOAD = env.bool(
    "DJANGO_SECURE_HSTS_PRELOAD",
    default=not DEBUG,
)

SECURE_PROXY_SSL_HEADER = (
    ("HTTP_X_FORWARDED_PROTO", "https")
    if env.bool("DJANGO_SECURE_PROXY_SSL_HEADER", default=not DEBUG)
    else None
)


# ============================================================
# GOOGLE OAUTH
# ============================================================

GOOGLE_CLIENT_ID = env(
    "GOOGLE_CLIENT_ID",
    default="",
)


# ============================================================
# PROPTECH BRAND DESIGN TOKENS
# ============================================================

PROPTECH_DESIGN_TOKENS = {
    "primary": "#408A71",
    "light_accent": "#A5E0CB",
    "hover": "#34745C",
    "deep_green": "#0B493A",
    "main_bg": "#F9FAFB",
    "surface": "#FFFFFF",
    "primary_text": "#111827",
    "secondary_text": "#64748B",
    "borders": "#E8EEEB",
    "subtle_green_bg": "#EAF6F0",
}


# ============================================================
# DJANGO UNFOLD ADMIN
# ============================================================

UNFOLD = {
    "SITE_TITLE": "PropTech Admin",
    "SITE_HEADER": "PropTech Platform",
    "SITE_SUBHEADER": "Property Management & Leasing Platform",
    "SITE_SYMBOL": "apartment",
    "SITE_URL": "/",
    "SHOW_HISTORY": True,
    "SHOW_VIEW_ON_SITE": True,
    "DASHBOARD_CALLBACK": "config.admin_dashboard.dashboard_callback",
    "ENVIRONMENT": None,
    "STYLES": [
        lambda request: static("admin/css/proptech_tokens.css"),
    ],
    "COLORS": {
        "primary": {
            "50": PROPTECH_DESIGN_TOKENS["subtle_green_bg"],  # #EAF6F0
            "100": "#D2EDE2",
            "200": PROPTECH_DESIGN_TOKENS["light_accent"],     # #A5E0CB
            "300": "#7DCFB5",
            "400": "#57B695",
            "500": PROPTECH_DESIGN_TOKENS["primary"],          # #408A71
            "600": PROPTECH_DESIGN_TOKENS["primary"],          # #408A71
            "700": PROPTECH_DESIGN_TOKENS["hover"],            # #34745C
            "800": "#225844",
            "900": PROPTECH_DESIGN_TOKENS["deep_green"],       # #0B493A
            "950": "#05281F",
        },
        "base": {
            "50": PROPTECH_DESIGN_TOKENS["main_bg"],           # #F9FAFB
            "100": "#F3F4F6",
            "200": PROPTECH_DESIGN_TOKENS["borders"],          # #E8EEEB
            "300": "#D1D5DB",
            "400": "#94A3B8",
            "500": PROPTECH_DESIGN_TOKENS["secondary_text"],   # #64748B
            "600": "#475569",
            "700": "#334155",
            "800": "#1E293B",
            "900": PROPTECH_DESIGN_TOKENS["primary_text"],     # #111827
            "950": "#0F172A",
        },
        "font": {
            "subtle-light": "var(--color-base-500)",
            "subtle-dark": "var(--color-base-400)",
            "default-light": "var(--color-base-900)",
            "default-dark": "var(--color-base-200)",
            "important-light": "var(--color-base-900)",
            "important-dark": "#FFFFFF",
        },
    },
    "SIDEBAR": {
        "show_search": True,
        "show_all_applications": False,
        "navigation": [
            {
                "title": _("Overview"),
                "separator": False,
                "collapsible": False,
                "items": [
                    {
                        "title": _("Dashboard"),
                        "icon": "dashboard",
                        "link": reverse_lazy("admin:index"),
                        "permission": lambda request: request.user.is_staff,
                    },
                ],
            },
            {
                "title": _("Users & Access"),
                "separator": True,
                "collapsible": True,
                "items": [
                    {
                        "title": _("Users"),
                        "icon": "person",
                        "link": reverse_lazy("admin:accounts_user_changelist"),
                        "permission": lambda request: request.user.has_perm("accounts.view_user"),
                    },
                    {
                        "title": _("User Profiles"),
                        "icon": "badge",
                        "link": reverse_lazy("admin:accounts_userprofile_changelist"),
                        "permission": lambda request: request.user.has_perm("accounts.view_userprofile"),
                    },
                    {
                        "title": _("Social Accounts"),
                        "icon": "link",
                        "link": reverse_lazy("admin:accounts_socialaccount_changelist"),
                        "permission": lambda request: request.user.has_perm("accounts.view_socialaccount"),
                    },
                    {
                        "title": _("Groups & Permissions"),
                        "icon": "admin_panel_settings",
                        "link": reverse_lazy("admin:auth_group_changelist"),
                        "permission": lambda request: request.user.has_perm("auth.view_group"),
                    },
                ],
            },
            {
                "title": _("Property Management"),
                "separator": True,
                "collapsible": True,
                "items": [
                    {
                        "title": _("Properties"),
                        "icon": "apartment",
                        "link": reverse_lazy("admin:properties_property_changelist"),
                        "permission": lambda request: request.user.has_perm("properties.view_property"),
                    },
                    {
                        "title": _("Property Images"),
                        "icon": "photo_library",
                        "link": reverse_lazy("admin:properties_propertyimage_changelist"),
                        "permission": lambda request: request.user.has_perm("properties.view_propertyimage"),
                    },
                    {
                        "title": _("Amenities"),
                        "icon": "pool",
                        "link": reverse_lazy("admin:properties_amenity_changelist"),
                        "permission": lambda request: request.user.has_perm("properties.view_amenity"),
                    },
                    {
                        "title": _("Property Amenities"),
                        "icon": "checklist",
                        "link": reverse_lazy("admin:properties_propertyamenity_changelist"),
                        "permission": lambda request: request.user.has_perm("properties.view_propertyamenity"),
                    },
                ],
            },
            {
                "title": _("Listing Moderation"),
                "separator": True,
                "collapsible": True,
                "items": [
                    {
                        "title": _("Listings"),
                        "icon": "storefront",
                        "link": reverse_lazy("admin:listings_listing_changelist"),
                        "permission": lambda request: request.user.has_perm("listings.view_listing"),
                    },
                    {
                        "title": _("Saved Properties"),
                        "icon": "bookmark",
                        "link": reverse_lazy("admin:listings_savedproperty_changelist"),
                        "permission": lambda request: request.user.has_perm("listings.view_savedproperty"),
                    },
                ],
            },
            {
                "title": _("Leasing"),
                "separator": True,
                "collapsible": True,
                "items": [
                    {
                        "title": _("Applications"),
                        "icon": "assignment",
                        "link": reverse_lazy("admin:leasing_application_changelist"),
                        "permission": lambda request: request.user.has_perm("leasing.view_application"),
                    },
                    {
                        "title": _("Application Status History"),
                        "icon": "history",
                        "link": reverse_lazy("admin:leasing_applicationstatushistory_changelist"),
                        "permission": lambda request: request.user.has_perm("leasing.view_applicationstatushistory"),
                    },
                    {
                        "title": _("Tenancies"),
                        "icon": "vpn_key",
                        "link": reverse_lazy("admin:leasing_tenancy_changelist"),
                        "permission": lambda request: request.user.has_perm("leasing.view_tenancy"),
                    },
                    {
                        "title": _("Documents"),
                        "icon": "folder",
                        "link": reverse_lazy("admin:documents_document_changelist"),
                        "permission": lambda request: request.user.has_perm("documents.view_document"),
                    },
                ],
            },
            {
                "title": _("Finance"),
                "separator": True,
                "collapsible": True,
                "items": [
                    {
                        "title": _("Rent Charges"),
                        "icon": "receipt_long",
                        "link": reverse_lazy("admin:rent_rentcharge_changelist"),
                        "permission": lambda request: request.user.has_perm("rent.view_rentcharge"),
                    },
                    {
                        "title": _("Payments"),
                        "icon": "payments",
                        "link": reverse_lazy("admin:rent_payment_changelist"),
                        "permission": lambda request: request.user.has_perm("rent.view_payment"),
                    },
                    {
                        "title": _("Payment Allocations"),
                        "icon": "account_balance_wallet",
                        "link": reverse_lazy("admin:rent_paymentallocation_changelist"),
                        "permission": lambda request: request.user.has_perm("rent.view_paymentallocation"),
                    },
                    {
                        "title": _("Refunds"),
                        "icon": "currency_exchange",
                        "link": reverse_lazy("admin:rent_paymentrefund_changelist"),
                        "permission": lambda request: request.user.has_perm("rent.view_paymentrefund"),
                    },
                    {
                        "title": _("Allocation Reversals"),
                        "icon": "history_toggle_off",
                        "link": reverse_lazy("admin:rent_paymentallocationreversal_changelist"),
                        "permission": lambda request: request.user.has_perm("rent.view_paymentallocationreversal"),
                    },
                ],
            },
            {
                "title": _("Subscriptions"),
                "separator": True,
                "collapsible": True,
                "items": [
                    {
                        "title": _("Subscription Plans"),
                        "icon": "workspace_premium",
                        "link": reverse_lazy("admin:subscriptions_subscriptionplan_changelist"),
                        "permission": lambda request: request.user.has_perm("subscriptions.view_subscriptionplan"),
                    },
                    {
                        "title": _("Owner Subscriptions"),
                        "icon": "card_membership",
                        "link": reverse_lazy("admin:subscriptions_subscription_changelist"),
                        "permission": lambda request: request.user.has_perm("subscriptions.view_subscription"),
                    },
                    {
                        "title": _("Subscription Payments"),
                        "icon": "receipt",
                        "link": reverse_lazy("admin:subscriptions_subscriptionpayment_changelist"),
                        "permission": lambda request: request.user.has_perm("subscriptions.view_subscriptionpayment"),
                    },
                ],
            },
            {
                "title": _("System"),
                "separator": True,
                "collapsible": True,
                "items": [
                    {
                        "title": _("Notifications"),
                        "icon": "notifications",
                        "link": reverse_lazy("admin:notifications_notification_changelist"),
                        "permission": lambda request: request.user.has_perm("notifications.view_notification"),
                    },
                ],
            },
        ],
    },
}
