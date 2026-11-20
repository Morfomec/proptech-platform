# PropTech Platform

A property-centric rental marketplace and portfolio management platform supporting residential and commercial properties.

## Architecture

- **Backend (`backend/`):** Django 6 + Django REST Framework + PostgreSQL + SimpleJWT modular monolith structured by domain (`apps.core`, `apps.accounts`, `apps.properties`, `apps.listings`, `apps.leasing`, `apps.documents`, `apps.notifications`, `apps.subscriptions`, `apps.rent`) following a strict `ViewSet → Serializer → Service → Model` layer separation, with OpenAPI schema generation via `drf-spectacular` and a custom administration interface powered by Django Unfold.
- **Frontend (`frontend/`):** React 19 + TypeScript + Vite + Tailwind CSS v4 + React Router + TanStack React Query + Axios single-page application separated into public property discovery, a dedicated **Tenant Workspace**, and a dedicated **Owner Workspace**.

## Project Status

### Implemented (MVP)

- **Authentication & Accounts (`apps.accounts`):** Email/password registration, email verification, password reset, JWT access/refresh token rotation & logout, Google OAuth 2.0 sign-in, and authentication-aware account settings.
- **Properties (`apps.properties`):** Residential and commercial property management, specifications, address/coordinates, amenities catalogue, and property image gallery uploads.
- **Listings & Discovery (`apps.listings`):** Draft, published, paused, and closed property listings; public property browsing at `/properties` with search, filtering, and sorting; and user-to-property Saved Properties.
- **Leasing (`apps.leasing`):** Rental application submission, withdrawal, owner review workflow (`submitted`, `under_review`, `approved`, `rejected`) with audit status history, and tenancy creation + lifecycle management (`pending`, `confirmed`, `active`, `ended`, `cancelled`).
- **Documents (`apps.documents`):** Private document upload, editing/replacement, attachment-scope filtering, and authenticated streaming download/preview across personal, property, application, and tenancy documents.
- **Notifications (`apps.notifications`):** Cross-party notifications for application, tenancy, and document events, unread counts, and mark-read actions.
- **Subscriptions & Owner Onboarding (`apps.subscriptions`):** Multi-tier subscription model (Starter, Growth, Pro, Enterprise), automated 90-day Starter free trial with idempotent activation, property quota tracking and enforcement, plan upgrades/downgrades with quota validation, and public owner onboarding flow (`/owner/get-started`).
- **Rent & Financial Management (`apps.rent`):** Monthly rent charge generation, security deposit tracking, manual payment recording (cash, bank transfer, cheque, other), automated FIFO payment allocation across outstanding charges, payment refunds, and per-tenancy running balance financial ledgers.
- **Platform Administration (Django Unfold):** Custom-styled Django Unfold Admin interface (`/admin/`) featuring branded KPI metric cards, grouped domain navigation, and administrative controls across all platform models.
- **Tenant Workspace (`/app/tenant/*`):** Overview dashboard, Browse Properties, Saved Properties, Applications & detail view, My Tenancy view (rent schedule, payment history, and security deposit status), Documents management, Notifications centre, and Shared Account Settings.
- **Owner Workspace (`/app/owner/*`):** Portfolio Overview dashboard, My Properties, Add/Edit Property wizard, Applications review, Tenancies lifecycle management, Rent & Payments management (charge generation, payment recording, and refund logging), Subscription & Quota management, Documents management, Header Notification Bell & Notifications centre, and Shared Account Settings.

### Planned / Future Phases

- AI-assisted rental listing description generation (deferred)
- Integrated online payment gateway (e.g. Stripe, Razorpay)
- Dedicated REST Admin oversight endpoints (beyond Django Unfold Admin)

## Local Development Setup

### Prerequisites

- Python 3 + PostgreSQL
- Node.js + npm

### Backend (`backend/`)

1. Copy `backend/.env.example` to `backend/.env` and configure `DJANGO_SECRET_KEY`, PostgreSQL credentials (`DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`), CORS/frontend origins, and optional `GOOGLE_CLIENT_ID`.
2. Create a virtual environment and install dependencies:
   ```bash
   cd backend
   python3 -m venv .venv
   .venv/bin/pip install -r requirements-lock.txt
   ```
3. Run database migrations and start the API server:
   ```bash
   .venv/bin/python manage.py migrate
   .venv/bin/python manage.py runserver
   ```
4. Live OpenAPI schema and interactive API docs are available at `/api/schema/`, `/api/docs/`, and `/api/redoc/`.

### Frontend (`frontend/`)

1. Copy `frontend/.env.example` to `frontend/.env` and configure `VITE_API_BASE_URL` (default `http://localhost:8000/api/v1`), `VITE_APP_URL`, and optional `VITE_GOOGLE_CLIENT_ID`.
2. Install packages and start the Vite dev server:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

### Verification Commands

- **Backend checks & tests:**
  ```bash
  cd backend
  .venv/bin/python manage.py check
  .venv/bin/python manage.py makemigrations --check --dry-run
  .venv/bin/python manage.py test
  ```
- **Backend production deployment readiness check:**
  ```bash
  cd backend
  .venv/bin/python manage.py check --deploy --settings=config.settings_production
  ```
- **Frontend lint & production build:**
  ```bash
  cd frontend
  npm run lint
  npm run build
  ```

## Production & Deployment Configuration

For production deployments, PropTech Platform includes a dedicated production settings profile (`config.settings_production`) enforcing strict HTTPS, secure cookie handling, HSTS, and reverse-proxy header detection.

### Activating Production Settings

Set the Django settings module in your production environment:
```bash
export DJANGO_SETTINGS_MODULE=config.settings_production
```

### Required Production Environment Variables

| Variable | Description | Example / Default |
|---|---|---|
| `DJANGO_SECRET_KEY` | Cryptographically strong secret key | *Required (no default)* |
| `DJANGO_DEBUG` | Disables debug mode in production | `False` |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated allowed domain names/IPs | `api.proptech.com,proptech.com` |
| `DB_NAME` | Production PostgreSQL database name | `proptech_platform_db` |
| `DB_USER` | Production PostgreSQL username | `proptech_user` |
| `DB_PASSWORD` | Production PostgreSQL password | *Required* |
| `DB_HOST` | Production database host | `db.internal.example.com` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `CORS_ALLOWED_ORIGINS` | Comma-separated frontend origins | `https://proptech.com` |
| `CSRF_TRUSTED_ORIGINS` | Comma-separated trusted origins for CSRF | `https://proptech.com` |
| `FRONTEND_URL` | Canonical public URL of the frontend | `https://proptech.com` |
| `DJANGO_SECURE_SSL_REDIRECT` | Redirects all HTTP traffic to HTTPS | `True` |
| `DJANGO_SECURE_PROXY_SSL_HEADER` | Trust `X-Forwarded-Proto: https` from load balancer/proxy | `True` |
| `DJANGO_SESSION_COOKIE_SECURE` | Enforces HTTPS-only transmission of session cookies | `True` |
| `DJANGO_CSRF_COOKIE_SECURE` | Enforces HTTPS-only transmission of CSRF cookies | `True` |
| `DJANGO_SECURE_HSTS_SECONDS` | HTTP Strict Transport Security duration (seconds) | `31536000` (1 year) |
| `DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS` | Enforces HSTS policy across all subdomains | `True` |
| `DJANGO_SECURE_HSTS_PRELOAD` | Allows domain submission to browser HSTS preload list | `True` |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 Client ID for social authentication | *(Optional)* |

## Project Documentation

Architectural and design specifications are maintained in the [`docs/`](docs/) directory:

- **[System Architecture](docs/system-architecture.md)**: Architectural overview, system diagrams, request flows, and infrastructure baseline.
- **[Module Boundaries](docs/module-boundaries.md)**: Django modular monolith structure, domain responsibilities, table ownership, and dependency rules.
- **[Database Design & ERD](docs/database-design.md)**: Relational data model, entity summaries, [DBML schema](docs/diagrams/database-erd.version.02.dbml), and ERD diagram.
- **[API Documentation](docs/api/README.md)**: REST API contract, live filter support, request/response envelopes, and [Postman Collection](docs/api/postman/PropTech_API_v1.postman_collection.json).
- **[Figma UI/UX Design](docs/design/figma.md)**: Canonical design system link and UI flow specifications.
- **[Product Requirements Document](docs/requirements.md)**: Target users, MVP feature scope, roles and permissions, and success criteria.
- **[AI Integration Plan](docs/ai-integration.md)**: Listing description generator design and fallback strategies.
- **[Execution Strategy](docs/project-planning-execution-strategy.md)**: Development milestones and deliverable verification criteria.
- **[Master System Blueprint](docs/final-system-blueprint.md)**: Consolidated system blueprint across milestones.
