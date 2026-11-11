# PropTech Platform API Documentation

This directory contains the API documentation and Postman collection representing the API contract for the PropTech platform.

---

## 1. Purpose of the API Contract

The API contract defines the interface and data exchange conventions between the React + TypeScript frontend application and the Django REST Framework backend modular monolith.

Establishing an explicit API contract prior to backend implementation serves several critical purposes:
- **Decoupled Frontend and Backend Workflows**: The frontend team can design user interfaces, simulate network state, and build interactive views against consistent endpoint signatures and mock data before backend endpoints are deployed.
- **Specification-First Development**: Backend developers implement serializers, viewsets, and business logic to satisfy predefined URL structures, parameter formats, request payloads, and status codes.
- **Predictable Error and Data Schemas**: Standardized JSON envelopes, authentication schemes, and status codes prevent integration friction across module boundaries.

> [!IMPORTANT]
> **API Implementation Status**: Core MVP endpoints for Authentication & Accounts, Properties & Amenities, Listings & Saved Properties, Leasing (Applications & Tenancies), Documents, and Notifications are implemented and documented live via OpenAPI at `/api/schema/` (Swagger UI at `/api/docs/`, ReDoc at `/api/redoc/`). Subscriptions, Rent & Ledger, and dedicated Administration REST endpoints remain planned/pending implementation.

---

## 2. Current MVP Modules

The MVP architecture partitions the application into dedicated domain modules as documented in [Module Boundaries](../module-boundaries.md) and [System Architecture](../system-architecture.md). The functional domains in accordance with the DBML Version 02 schema are:

| Module | Scope in API Contract | Implemented Endpoints (under `/api/v1`) |
| :--- | :--- | :--- |
| **Authentication & Accounts** | User registration, email verification, authentication, token refresh/rotation, logout, password recovery, Google OAuth 2.0, and user profiles. | `/auth/register/`, `/auth/verify-email/`, `/auth/resend-email-verification/`, `/auth/login/`, `/auth/google/`, `/auth/token/refresh/`, `/auth/logout/`, `/auth/password-reset/request/`, `/auth/password-reset/confirm/`, `/auth/change-password/`, `/auth/profile/` |
| **Properties** | Property-centric real estate assets (residential and commercial), physical specs, coordinates, amenities catalogue, and property photo gallery. | `/properties/`, `/properties/me/`, `/properties/{property_uuid}/`, `/properties/{property_uuid}/images/`, `/properties/{property_uuid}/images/{image_uuid}/`, `/properties/{property_uuid}/images/{image_uuid}/primary/`, `/amenities/` |
| **Listings & Discovery** | Public rental marketplace listings (with query search/filter/sort), asking terms, lifecycle actions, and saved properties. | `/listings/`, `/listings/me/`, `/listings/{listing_uuid}/`, `/listings/{listing_uuid}/publish/`, `/listings/{listing_uuid}/pause/`, `/listings/{listing_uuid}/close/`, `/saved-properties/`, `/saved-properties/{property_uuid}/` |
| **Leasing & Tenancies** | Rental applications, status history audit trails, agreed tenancies, and attached private documents (including rental agreements). | `/applications/`, `/applications/me/`, `/applications/received/`, `/applications/{application_uuid}/`, `/applications/{application_uuid}/review/`, `/applications/{application_uuid}/withdraw/`, `/tenancies/`, `/tenancies/me/`, `/tenancies/managed/`, `/tenancies/{tenancy_uuid}/`, `/tenancies/{tenancy_uuid}/confirm/`, `/tenancies/{tenancy_uuid}/activate/`, `/tenancies/{tenancy_uuid}/cancel/`, `/tenancies/{tenancy_uuid}/end/`, `/documents/`, `/documents/{document_uuid}/`, `/documents/{document_uuid}/download/` |
| **Notifications** | In-app user notifications, unread counts, and read receipts. | `/notifications/`, `/notifications/{notification_uuid}/`, `/notifications/unread-count/`, `/notifications/{notification_uuid}/read/`, `/notifications/read-all/` |
| **Subscriptions** *(Planned)* | Owner SaaS subscription tiers, active subscriptions, property quota tracking, and subscription payments. | *Not yet exposed via REST API* |
| **Rent & Ledger** *(Planned)* | Rent charges, manual payment logging, refund tracking, and payment allocations. | *Not yet exposed via REST API* |
| **Administration** *(Oversight)* | Platform oversight via Django Admin (`/admin/`) and read-only API oversight on Properties, Listings, Applications, Tenancies, and Documents. | *Dedicated `/admin/...` REST endpoints not yet implemented* |

### Implemented Query Filters

- **Listings (`GET /api/v1/listings/me/`):** Supports optional `status` query filtering (`draft`, `published`, `paused`, `closed`, single or comma-separated) alongside standard pagination (`page`, `page_size`). Public `GET /api/v1/listings/` supports search, city/locality, category, property type, rent range, bedrooms, furnishing, availability date, and sorting.
- **Received Applications (`GET /api/v1/applications/received/`):** Supports optional `status` query filtering (`submitted`, `under_review`, `approved`, `rejected`, `withdrawn`, single or comma-separated) and pagination.
- **Managed Tenancies (`GET /api/v1/tenancies/managed/`):** Supports optional `status` query filtering (`pending`, `confirmed`, `active`, `ended`, `cancelled`) and pagination.
- **Documents (`GET /api/v1/documents/`):** Supports optional `scope` (`all`, `property`, `application`, `tenancy`, `personal`) as well as UUID filters `property_id`, `application_id`, and `tenancy_id`, scoped strictly to documents accessible to the authenticated user.
- **Notifications (`GET /api/v1/notifications/`):** Supports optional `is_read` boolean filtering (`true` / `false`) and pagination.

> [!NOTE]
> **API Contract Alignment**: The attached Postman collection was originally drafted prior to the consolidation of the property-centric schema. Certain legacy folders (e.g. standalone `/units/` and standalone `/agreements/`) reflect the pre-consolidation design. Backend serializers, viewsets, and updated Postman requests will follow the property-centric DBML schema (where properties are the direct rentable assets, pricing resides in listings and tenancies, and rental agreements are tenancy documents).

---

## 3. Postman Collection

The canonical Postman collection file is located at:
[`docs/api/postman/PropTech_API_v1.postman_collection.json`](postman/PropTech_API_v1.postman_collection.json)

### How to Import into Postman

1. Open the **Postman** desktop application (or Postman Web).
2. Click the **Import** button in the upper-left navigation panel.
3. Drag and drop the file `docs/api/postman/PropTech_API_v1.postman_collection.json`, or click **Files** to browse and select it.
4. Confirm import as a **Collection**.
5. Create or select a Postman **Environment** (e.g., `PropTech Local Dev`).
6. Configure the environment variables as described below.

---

## 4. Environment and Base URL

The collection uses variable interpolation (e.g., `{{base_url}}`, `{{access_token}}`) across all requests.

### Provisional Local Base URL

```text
http://127.0.0.1:8000/api/v1
```

*(Alternatively `http://localhost:8000/api/v1`)*

### Recommended Environment Variables

Configure the following variables in your Postman environment:

| Variable | Initial Value | Description |
| :--- | :--- | :--- |
| `base_url` | `http://127.0.0.1:8000/api/v1` | Root URL for the local Django REST Framework API. |
| `access_token` | *(empty string)* | JWT bearer access token returned from login. |
| `refresh_token` | *(empty string)* | JWT refresh token used to obtain a new access token. |
| `property_uuid` | *(empty string)* | UUID of an active test property. |
| `listing_uuid` | *(empty string)* | UUID of an active test listing. |
| `tenancy_uuid` | *(empty string)* | UUID of an active test tenancy. |
| `payment_uuid` | *(empty string)* | UUID of an active test payment record. |
| `document_uuid` | *(empty string)* | UUID of an active test document (e.g., rental agreement). |

---

## 5. Authentication & Request/Response Conventions

Based on the Postman collection specification, requests follow standard REST and JSON conventions:

### Authentication Scheme
- **Mechanism**: JSON Web Tokens (JWT) using Bearer authentication.
- **Header**: Protected endpoints require the HTTP header:
  ```http
  Authorization: Bearer {{access_token}}
  ```
- **Login Flow**:
  1. Dispatch `POST {{base_url}}/auth/login/` with `email` and `password`.
  2. The response supplies an `access` token and a `refresh` token.
  3. Store the access token in Postman's `access_token` variable.
  4. When the access token expires, dispatch `POST {{base_url}}/auth/refresh/` with the `refresh` token to obtain a fresh access token.

### Data Formats & Identifiers
- **Content Type**: Standard request and response bodies use `application/json; charset=utf-8`.
- **File Uploads**: Media uploads (such as property images or verification files) use `multipart/form-data`.
- **Field Casing**: All JSON property keys use `snake_case` (e.g., `first_name`, `monthly_rent`, `security_deposit`, `is_primary`).
- **Identifiers**: Primary and foreign keys are represented as UUID strings (e.g., `3fa85f64-5717-4562-b3fc-2c963f66afa6`).
- **Timestamps**: Date and time values follow ISO 8601 formatting (e.g., `2026-10-29T10:00:00Z`).

### Response Envelopes & HTTP Status Codes
- **Standard Success Envelope**:
  ```json
  {
    "success": true,
    "message": "Operation completed successfully.",
    "data": {}
  }
  ```
- **Standard Paginated List Envelope** (`StandardResultsSetPagination`):
  ```json
  {
    "success": true,
    "message": "Data retrieved successfully.",
    "count": 20,
    "next": null,
    "previous": null,
    "results": [],
    "data": []
  }
  ```
- **Standard Error Envelope**:
  ```json
  {
    "success": false,
    "message": "Request failed.",
    "errors": {}
  }
  ```
- `GET`: Read resources or collections (`200 OK`; binary `FileResponse` on `/documents/{id}/download/`).
- `POST`: Create new resources (`201 Created`) or trigger actions (`200 OK`; `POST /saved-properties/` returns `201 Created` on create or `200 OK` if already saved).
- `PATCH` / `PUT`: Update existing resources (`200 OK`).
- `DELETE`: Remove resources (`200 OK` with standard JSON envelope).
- Error codes follow standard HTTP semantics:
  - `400 Bad Request`: Validation errors or invalid payloads.
  - `401 Unauthorized`: Missing or invalid authentication token.
  - `403 Forbidden`: Authenticated user lacks permission for the resource.
  - `404 Not Found`: Resource does not exist.
  - `429 Too Many Requests`: Scoped authentication rate limit exceeded.

---

## 6. Distinguishing Endpoint Maturity Levels

When working with this collection, distinguish between the following three tiers:

1. **Mock Examples**:
   - The collection includes over 130 mock example responses embedded in the JSON.
   - These illustrate sample payload structures, realistic field values, and expected response codes.
   - They provide the contract target for frontend component mocking and integration tests.

2. **Proposed Endpoints**:
   - The requests represent planned routes designed to satisfy system requirements.
   - Certain collection folders include extended or advanced workflows (e.g., in-app messaging, automated trust scoring, or maintenance timelines) that are categorized in project planning for future phases beyond the immediate 3-week MVP.

3. **Implemented Endpoints**:
   - Implemented endpoints for Authentication & Accounts, Properties, Listings & Saved Properties, Applications & Tenancies, Documents, and Notifications are backed by Django viewsets, serializers, services, migrations, and automated test suites, and are documented live via OpenAPI (`/api/schema/`, `/api/docs/`, `/api/redoc/`).
   - Modules marked *Planned* (Subscriptions, Rent & Ledger, and dedicated `/admin/...` REST endpoints) remain unimplemented until their corresponding milestone work begins.
