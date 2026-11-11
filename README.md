# PropTech Platform

A property-centric rental marketplace and portfolio management platform supporting residential and commercial properties.

## Architecture

- **Backend (`backend/`):** Django 6 + Django REST Framework + PostgreSQL + SimpleJWT modular monolith structured by domain (`apps.core`, `apps.accounts`, `apps.properties`, `apps.listings`, `apps.leasing`, `apps.documents`, `apps.notifications`) following a strict `ViewSet → Serializer → Service → Model` layer separation, with OpenAPI schema generation via `drf-spectacular`.
- **Frontend (`frontend/`):** React 19 + TypeScript + Vite + Tailwind CSS v4 + React Router + TanStack React Query + Axios single-page application separated into public property discovery, a dedicated **Tenant Workspace**, and a dedicated **Owner Workspace**.

## Project Status

### Implemented (MVP)

- **Authentication & Accounts (`apps.accounts`):** Email/password registration, email verification, password reset, JWT access/refresh token rotation & logout, Google OAuth 2.0 sign-in, and authentication-aware account settings.
- **Properties (`apps.properties`):** Residential and commercial property management, specifications, address/coordinates, amenities catalogue, and property image gallery uploads.
- **Listings & Discovery (`apps.listings`):** Draft, published, paused, and closed property listings; public property browsing at `/properties` with search, filtering, and sorting; and user-to-property Saved Properties.
- **Leasing (`apps.leasing`):** Rental application submission, withdrawal, owner review workflow (`submitted`, `under_review`, `approved`, `rejected`) with audit status history, and tenancy creation + lifecycle management (`pending`, `confirmed`, `active`, `ended`, `cancelled`).
- **Documents (`apps.documents`):** Private document upload, editing/replacement, attachment-scope filtering, and authenticated streaming download/preview across personal, property, application, and tenancy documents.
- **Notifications (`apps.notifications`):** Cross-party notifications for application, tenancy, and document events, unread counts, and mark-read actions.
- **Tenant Workspace (`/app/tenant/*`):** Overview dashboard, Browse Properties, Saved Properties, Applications & detail view, Active Tenancy view, Documents management, Notifications centre, and Shared Account Settings.
- **Owner Workspace (`/app/owner/*`):** Portfolio Overview dashboard, My Properties, Add/Edit Property wizard, Applications review, Tenancies lifecycle management, Documents management, Header Notification Bell & Notifications centre, and Shared Account Settings.

### Planned / Future Phases

- Owner subscription tiers and property quota tracking
- Rent charges, payment logging, refunds, and ledger allocations
- AI-assisted rental listing description generation
- Dedicated REST Admin oversight endpoints

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
- **Frontend lint & production build:**
  ```bash
  cd frontend
  npm run lint
  npm run build
  ```

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
