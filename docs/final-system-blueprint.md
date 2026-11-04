# Master System Blueprint: PropTech Platform

This document serves as the **consolidated system blueprint and final submission deliverable** for the PropTech platform. It compiles all architectural decisions, design artifacts, domain models, communication protocols, and project milestones into a unified specification.

---

## 1. Problem Statement & System Overview (Item a)

### 1.1 Problem Statement
The residential and commercial rental market suffers from fragmented workflows spanning disconnected listing portals, chat applications, and manual spreadsheets. Property owners struggle with tedious listing composition, disjointed applicant screening, and error-prone manual rent ledgers. Tenants encounter inconsistent listing details, lack of transparency in application statuses, and fragmented payment tracking.

### 1.2 System Overview
The **PropTech Platform** is a unified rental marketplace and property-management application. It streamlines the end-to-end rental lifecycle:
1. **Discovery & Marketplace**: Tenants search verified listings and submit structured applications.
2. **Property & Tenancy Management**: Owners manage properties (across residential and commercial categories), review applicants, establish tenancies, and track rent charges, payments, and refunds.
3. **AI Assistant**: Accelerates listing composition by generating editable marketing drafts from verified property specifications.

**Target Personas:**
- **Property Owner**: Manages real estate assets within subscription quotas, creates listings, reviews tenant applications, attaches rental agreements, and logs rent receipts.
- **Tenant**: Explores public listings, submits applications, views tenancy terms, and tracks rent charges and payment history.
- **Administrator**: Oversees system integrity, user moderation, and platform operations via Django Admin.

---

## 2. Product Scope & User Roles (Item a)

### 2.1 MVP Scope (P0)
- **Authentication & RBAC**: Role-based access control for Owners, Tenants, and Admins using custom email-based accounts and Google OAuth 2.0 social accounts (`social_accounts`).
- **Property Management**: Property-centric architecture (one property is one independently rentable asset across residential and commercial categories/types), address details, coordinates, amenities catalogue, and authoritative photo gallery.
- **Subscriptions & Quota Management**: Owner SaaS subscription tiers (Starter, Growth, Pro, Enterprise), active subscriptions, trial tracking, and transactional property quota enforcement (locking the owner or active subscription row, counting all properties belonging to the owner, validating against applicable plan quota, and creating the property within the same transaction).
- **Listings & Discovery**: Listing composition, asking terms (rent, deposit, available_from), moderation controls, and public search/filtering.
- **AI Listing Descriptions**: Automated draft descriptions generated via external AI provider with mandatory owner review and editing prior to publication.
- **Rental Applications**: Tenant application submissions, append-only status audit trails, and owner review workflows.
- **Tenancy & Agreements**: Conversion of approved applications into active tenancies, date overlap protection via PostgreSQL exclusion constraints, and tenancy-linked rental agreement documents.
- **Rent & Payment Tracking**: Recurring rent charges, manual payment logging, refund tracking, payment allocations, and outstanding balance calculation.

### 2.2 Out-of-Scope (Deferred Post-MVP)
- Automated online payment gateway integration (Stripe/Razorpay) — *manual payment logging only in MVP*.
- Real-time in-app chat and messaging.
- Algorithmic tenant credit scoring and background verification.
- AI tenant-property matchmaking engines.
- Multi-seat organization management and distributed microservices.

*Source of truth: [Product Requirements Document (PRD)](requirements.md)*

---

## 3. UI/UX Design — Figma (Item b)

The visual design system, interaction patterns, wireframes, and responsive user flows are maintained in Figma:

- **Canonical Figma Reference**: [PropTech UI Design on Figma](https://www.figma.com/design/r4INzMqS4Z5hEmoMYkrAie/PropTech?node-id=112-5022&p=f&t=wpXOG0tOdNVMByaQ-0)
- **Design Documentation**: [`docs/design/figma.md`](design/figma.md)

### Key Mapped Screens & Flows:
1. **Authentication & Profile Setup**: Registration, credential verification, and profile management.
2. **Owner Property Dashboard**: Property registration forms (residential/commercial categories & types), location mapping, amenity checklists, and photo gallery management.
3. **Listing Studio & AI Assistant**: Listing form integrating prompt preview, AI draft generation, inline editing, and publishing controls.
4. **Tenant Marketplace**: Search bar, filter drawers (rent range, bedrooms, amenities), listing cards, and detailed property views.
5. **Application & Leasing Pipeline**: Application submission modal for tenants; review, approval, and tenancy onboarding cards for owners.
6. **Rent Ledger & History**: Rent charge schedule, payment logging modal, refund tracking, and tenant ledger balances.

---

## 4. System Architecture & High-Level Diagram (Item c)

The platform is engineered as a **Django modular monolith** paired with a single-page React + TypeScript frontend and a single PostgreSQL database:

```mermaid
graph LR
    subgraph Client [Client Tier]
        Frontend[React Frontend<br>TypeScript SPA]
    end

    subgraph Edge [Edge / Ingress]
        Proxy[Reverse Proxy / HTTPS<br>Nginx / Cloud Ingress]
    end

    subgraph Backend [Backend Monolith - Django & DRF]
        API[REST API Layer<br>OpenAPI Documented]
        Services[Service Layer Interfaces]

        subgraph Modules [Django Apps]
            Accounts[accounts]
            Properties[properties]
            Listings[listings]
            Leasing[leasing]
            Rent[rent]
            Subscriptions[subscriptions]
            AIModule[ai_assistant]
            Shared[notifications, audit_logs, documents, common]
        end
    end

    subgraph Storage [Persistence & Storage]
        DB[(PostgreSQL Database)]
        FileStore[(File Storage<br>Media / Cloud Object Storage)]
    end

    subgraph External [External Services]
        AIProvider[External AI Provider API]
    end

    Frontend -->|HTTPS / REST API| Proxy
    Proxy -->|Synchronous WSGI/ASGI| API
    API --> Services
    Services --> Modules
    Modules --> DB
    Modules --> FileStore
    AIModule -->|HTTPS API Call| AIProvider
```

### Architectural Principles:
- **Monolith Runtime**: All modules execute within a single backend application process, avoiding distributed operational overhead.
- **Strict Domain Partitioning**: Business logic is encapsulated in Django apps with explicit table ownership.
- **Synchronous In-Process Service Calls**: Modules interact via typed Python service functions (e.g. `leasing.services`, `subscriptions.services`) inside database transactions (`transaction.atomic()`).

*Detailed specification: [System Architecture](system-architecture.md)*

---

## 5. Service / Module Breakdown (Item d)

The backend is partitioned into ten logically separated modules:

| Module | Core Responsibility | Data Owned (Tables) | Direct Dependencies |
| :--- | :--- | :--- | :--- |
| **`accounts`** | User authentication, identity, profiles, social accounts (OAuth 2.0), and RBAC. | `users`, `user_profiles`, `social_accounts` | *None (Foundational)* |
| **`properties`** | Physical real estate assets (residential & commercial), photos, and amenities catalogue. | `properties`, `property_images`, `amenities`, `property_amenities` | `accounts`, `subscriptions` (for quota checks) |
| **`listings`** | Public rental listings, asking terms, publication moderation, and saved properties. | `listings`, `saved_properties` | `properties`, `accounts`, `ai_assistant` |
| **`leasing`** | Applications, status workflows, and tenancies. *(Rental agreements tracked in `documents`).* | `applications`, `application_status_history`, `tenancies` | `listings`, `properties`, `accounts` |
| **`rent`** | Rent charges, manual payments, refunds, allocations, and balances. | `rent_charges`, `payments`, `payment_refunds`, `payment_allocations` | `leasing`, `accounts` |
| **`subscriptions`** | Owner SaaS subscription tiers, property quotas, active subscriptions, and billing. | `subscription_plans`, `subscriptions`, `subscription_payments` | `accounts` |
| **`ai_assistant`** | Listing description draft generation isolating external AI provider. | *Stateless (No persistent tables)* | *None (External API adapter)* |
| **`notifications`** | In-app user notifications and delivery status. | `notifications` | `accounts` |
| **`audit_logs`** | Immutable historical audit trail for critical state transitions. | `audit_logs` | `accounts` |
| **`documents`** | Centralized file metadata, attachment tracking, and tenancy rental agreements. | `documents` | `accounts` |

*Detailed rules and dependency graph: [Module Boundaries](module-boundaries.md)*

---

## 6. Database Design (Item e)

The relational schema comprises **22 tables** implemented in PostgreSQL using UUID primary keys, ISO timestamps, INR currency decimals, and strict referential integrity constraints:

```text
├── Accounts (3 tables)
│   ├── users
│   ├── user_profiles
│   └── social_accounts
├── Properties & Amenities (4 tables)
│   ├── properties
│   ├── property_images
│   ├── amenities
│   └── property_amenities
├── Listings (2 tables)
│   ├── listings
│   └── saved_properties
├── Leasing (3 tables)
│   ├── applications
│   ├── application_status_history
│   └── tenancies
├── Rent & Ledger (4 tables)
│   ├── rent_charges
│   ├── payments
│   ├── payment_refunds
│   └── payment_allocations
├── Subscriptions (3 tables)
│   ├── subscription_plans
│   ├── subscriptions
│   └── subscription_payments
└── Supporting Services (3 tables)
    ├── notifications
    ├── audit_logs
    └── documents
```

### Key Artifacts:
- **Design Overview**: [`docs/database-design.md`](database-design.md)
- **DBML Schema Source**: [`docs/diagrams/database-erd.version.02.dbml`](diagrams/database-erd.version.02.dbml)
- **Visual ERD Diagram**: [`docs/diagrams/database-erd.png`](diagrams/database-erd.png)

---

## 7. API Design & Documentation (Item f)

The platform exposes a synchronous RESTful API built with Django REST Framework adhering to standard JSON conventions:

- **API Documentation**: [`docs/api/README.md`](api/README.md)
- **Canonical Postman Collection**: [`docs/api/postman/PropTech_API_v1.postman_collection.json`](api/postman/PropTech_API_v1.postman_collection.json)

### Contract Conventions:
- **Provisional Base URL**: `http://127.0.0.1:8000/api/v1`
- **Authentication**: JWT Bearer token passed via HTTP header:
  ```http
  Authorization: Bearer {{access_token}}
  ```
- **Payload Format**: `application/json` with `snake_case` keys and UUID resource identifiers.
- **Media Uploads**: `multipart/form-data` for property images and uploaded tenancy documents.
- **Maturity Distinction**: The Postman collection contains mock examples providing the target contract for frontend integration; backend routes will become operational as Django viewsets and serializers are implemented.

---

## 8. Communication & Infrastructure Design (Item g)

### 8.1 Tier Communication
1. **Frontend-to-Backend**: The React SPA communicates with Django REST Framework over HTTPS using standard REST endpoints.
2. **Inter-Module Communication**: Domain modules interact via Python service-layer calls within the same process. Direct cross-module SQL mutations are prohibited.
3. **External AI Communication**: The `ai_assistant` module interacts with the external AI provider over outbound HTTPS with strict timeouts and error fallbacks.

### 8.2 Conceptual Domain Events (MVP vs. Future)
To maintain architectural seams without introducing distributed queue overhead, the MVP models business events as synchronous service calls executed inside database transactions (`transaction.atomic()`):

| Conceptual Event | Triggering Module | Synchronous MVP Action | Future Consumer (Post-MVP) |
| :--- | :--- | :--- | :--- |
| `ListingPublished` | `listings` | Status set to published; visible in public search. | Search indexer, marketing emails. |
| `ApplicationSubmitted` | `leasing` | Application record created; owner notification generated. | SMS / Push notifications. |
| `ApplicationApproved` | `leasing` | Application approved; tenancy drafted; applicant notified. | Digital lease signing dispatch. |
| `TenancyCreated` | `leasing` | Tenancy activated; property status set to occupied; initial rent charge created. | Welcome email, calendar alerts. |
| `PaymentRecorded` | `rent` | Manual payment recorded; allocated to charges; balance recalculated. | Tenant receipt email, ledger export. |
| `SubscriptionActivated` | `subscriptions` | Owner subscription activated; owner property quota updated. | Welcome email, invoice dispatch. |

*Detailed infrastructure baseline: [System Architecture](system-architecture.md)*

---

## 9. AI Integration Plan (Item h)

The platform's initial AI capability is focused on **automated rental listing description draft generation**:

- **Input**: Verified property facts (category, property type, bedrooms, bathrooms, area, furnishing, amenities, location).
- **Processing**: The `ai_assistant` formats a structured prompt, applies safety filters, and queries the external provider over HTTPS.
- **Output**: An editable marketing description draft returned to the owner's browser.
- **Human-in-the-Loop Safeguard**: The AI service cannot persist or publish listings directly; all drafts must be explicitly reviewed, edited, and approved by the property owner.
- **Fault Tolerance**: If the AI provider is unavailable or times out, the UI gracefully informs the owner and provides a manual copy editor without blocking listing creation.

*Detailed prompt templates, validation rules, and error handling: [AI Integration Plan](ai-integration.md)*

---

## 10. End-to-End User Journey

The unified system supports the complete end-to-end user lifecycle:
1. **Registration**: An owner registers and authenticates via `/auth/register/` and `/auth/login/`.
2. **Asset Setup**: The owner creates a property (residential or commercial) within their active subscription quota and associates catalogued amenities and photos.
3. **Listing Composition**: The owner drafts a listing, invokes the AI assistant for description copy, edits the text, and publishes the listing.
4. **Discovery & Application**: A prospective tenant searches public listings, reviews property attributes, and submits a rental application.
5. **Review & Approval**: The owner reviews the application and approves it.
6. **Tenancy Onboarding**: The approved application is converted into an active tenancy with an attached rental agreement document.
7. **Ledger & Settlement**: Monthly rent charges are generated; the owner records manual tenant payments; payment allocations settle outstanding charges, handle refunds when necessary, and update tenant balances.

---

## 11. Milestone Completion Matrix

All mandatory milestones from project planning (`SecondProject - Flow`) are completed and integrated into version control:

| Milestone / Requirement | Deliverable Path | Status |
| :--- | :--- | :--- |
| **1. Product Scope & Modules** | [`docs/requirements.md`](requirements.md) | **Complete** |
| **2. UI/UX Design (Figma)** | [`docs/design/figma.md`](design/figma.md) | **Complete** |
| **3. High-Level Architecture** | [`docs/system-architecture.md`](system-architecture.md) | **Complete** |
| **4. Service Breakdown** | [`docs/module-boundaries.md`](module-boundaries.md) | **Complete** |
| **5. Database Design & ERD** | [`docs/database-design.md`](database-design.md) & [`docs/diagrams/`](diagrams/) | **Complete** |
| **6. API Design & Postman** | [`docs/api/README.md`](api/README.md) & [`docs/api/postman/`](api/postman/) | **Complete** |
| **7. Communication Design** | [`docs/system-architecture.md`](system-architecture.md) & Section 8 above | **Complete** |
| **8. AI Integration Plan** | [`docs/ai-integration.md`](ai-integration.md) | **Complete** |
| **9. Final System Blueprint** | [`docs/final-system-blueprint.md`](final-system-blueprint.md) | **Complete** |
| **10. Execution Strategy** | [`docs/project-planning-execution-strategy.md`](project-planning-execution-strategy.md) | **Complete** |
