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
> **API Implementation Status**: This collection is a **design specification and API contract proposal**. Backend implementation is currently in the initial development phase; endpoints are **not yet operational** on a live server. Do not assume endpoints are implemented merely because they are defined in the Postman collection.

---

## 2. Current MVP Modules

The MVP architecture partitions the application into dedicated domain modules as documented in [Module Boundaries](../module-boundaries.md) and [System Architecture](../system-architecture.md). The canonical API contract defines endpoints supporting these MVP functional domains:

| Module | Scope in API Contract | Key Endpoints / Resources |
| :--- | :--- | :--- |
| **Authentication & Accounts** | User registration, authentication, token refresh, password recovery, and user profiles. | `/auth/register/`, `/auth/login/`, `/auth/logout/`, `/auth/refresh/`, `/profile/me/` |
| **Properties** | Real estate property management, locations, and property media. | `/properties/`, `/properties/me/`, `/properties/{property_uuid}/`, `/properties/{property_uuid}/images/` |
| **Units & Pricing** | Rentable units under properties, unit amenities, and pricing configurations. | `/units/`, `/properties/{property_uuid}/units/`, `/units/{unit_uuid}`, `/unit-pricing/` |
| **Listings & Discovery** | Public rental marketplace listings, search, publication, and saved listings. | `/listings/`, `/listings/search`, `/listings/{listing_uuid}/`, `/listings/{listing_uuid}/publish/`, `/saved-listings/` |
| **Leasing & Agreements** | Rental applications, applicant processing, and tenancy agreements. | `/agreements`, `/agreements/{agreement_uuid}`, application workflows |
| **Rent & Payments** | Rent charges, manual payment logging, receipts, and payment history. | `/payments`, `/payments/{payment_uuid}`, `/payments/history` |
| **Notifications** | In-app user notifications and read receipts. | `/notifications`, `/notifications/{notification_id}/read` |
| **Administration** | Platform oversight, user management, and moderation actions. | `/admin/users`, `/admin/properties`, `/admin/reports` |

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
| `unit_uuid` | *(empty string)* | UUID of an active test unit. |
| `listing_uuid` | *(empty string)* | UUID of an active test listing. |
| `agreement_uuid` | *(empty string)* | UUID of an active test tenancy agreement. |
| `payment_uuid` | *(empty string)* | UUID of an active test payment record. |

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

### HTTP Methods & Status Codes
- `GET`: Read resources or collections (`200 OK`).
- `POST`: Create new resources or trigger actions (`201 Created` or `200 OK`).
- `PATCH`: Partially update existing resources (`200 OK`).
- `PUT`: Complete resource replacement (`200 OK`).
- `DELETE`: Remove resources (`204 No Content` or `200 OK`).
- Error codes follow standard HTTP semantics:
  - `400 Bad Request`: Validation errors or invalid payloads.
  - `401 Unauthorized`: Missing or invalid authentication token.
  - `403 Forbidden`: Authenticated user lacks permission for the resource.
  - `404 Not Found`: Resource does not exist.

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
   - Endpoints are implemented only after the corresponding Django model, viewset, serializer, and URL route have been committed, migrated, and verified with automated test suites.
   - At this stage of development, the backend implementation is underway and no live endpoints should be assumed operational until validated.
