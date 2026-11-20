"""
Production settings profile for PropTech Platform.

Extends the base configuration from `config.settings` with production-hardened defaults:
- Enforces DEBUG = False
- Enforces HTTPS redirection, secure session cookies, and secure CSRF cookies
- Enables HTTP Strict Transport Security (HSTS) with subdomains and preload support
- Configures reverse-proxy SSL header detection (SECURE_PROXY_SSL_HEADER)
- Enforces strict X-Frame-Options and Content-Type sniffing protections

Usage:
    export DJANGO_SETTINGS_MODULE=config.settings_production
    python manage.py check --deploy
"""

from config.settings import *  # noqa: F401, F403
from config.settings import env

# Production is strictly non-debug
DEBUG = False

# Production Allowed Hosts - Must be configured in environment
# e.g., DJANGO_ALLOWED_HOSTS=api.proptech.example.com,proptech.example.com
ALLOWED_HOSTS = env.list(
    "DJANGO_ALLOWED_HOSTS",
    default=["localhost", "127.0.0.1"],
)

# HTTPS Redirection
SECURE_SSL_REDIRECT = env.bool(
    "DJANGO_SECURE_SSL_REDIRECT",
    default=True,
)

# Trust reverse-proxy header for HTTPS (e.g. AWS ALB, Nginx, Cloudflare)
# Can be disabled by setting DJANGO_SECURE_PROXY_SSL_HEADER=False if terminates directly
SECURE_PROXY_SSL_HEADER = (
    ("HTTP_X_FORWARDED_PROTO", "https")
    if env.bool("DJANGO_SECURE_PROXY_SSL_HEADER", default=True)
    else None
)

# Secure Cookies (HTTPS Only)
SESSION_COOKIE_SECURE = env.bool(
    "DJANGO_SESSION_COOKIE_SECURE",
    default=True,
)
CSRF_COOKIE_SECURE = env.bool(
    "DJANGO_CSRF_COOKIE_SECURE",
    default=True,
)

# HTTP Strict Transport Security (HSTS)
# Default: 1 year (31,536,000 seconds)
SECURE_HSTS_SECONDS = env.int(
    "DJANGO_SECURE_HSTS_SECONDS",
    default=31536000,
)
SECURE_HSTS_INCLUDE_SUBDOMAINS = env.bool(
    "DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS",
    default=True,
)
SECURE_HSTS_PRELOAD = env.bool(
    "DJANGO_SECURE_HSTS_PRELOAD",
    default=True,
)

# Security Headers
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

