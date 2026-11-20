# Owner Rent & Payments — Backend API Readiness Audit

**Document:** `docs/audits/owner-rent-api-readiness.md`  
**Date:** 2026-11-18  
**Scope:** Backend (`backend/apps/rent/`, `backend/apps/leasing/`) readiness assessment for the upcoming Owner Portal Rent & Payments frontend module.

---

## 1. Executive Summary & Readiness Verdict

| Audit Area | Status | Assessment |
|---|---|---|
| **Payments Ingestion & History** | **Ready** | `POST /api/v1/payments/` and `GET /api/v1/payments/` are implemented, paginated, and strictly authorization-guarded. |
| **Payment Allocation Engine** | **Internal Only** | Automated FIFO allocation logic is implemented at service layer, but allocation records are not exposed to clients via API. |
| **Refund Workflow** | **Ready (Per-Payment)** | Per-payment refund creation, processing, and reversal audit trails are fully exposed via `/api/v1/payments/{id}/refunds/` and `/api/v1/refunds/{id}/`. |
| **Rent Charges Listing & Filtering** | **Missing from API** | The `RentCharge` database model and service generator exist, but **no REST API endpoint or serializer** exists to query rent charges. |
| **Financial Summaries & Balances** | **Missing from API** | No endpoint exposes portfolio-level or tenancy-level financial aggregates (total billed, total collected, outstanding balance, overdue amount). |
| **Payment Receipts** | **Missing from API** | No downloadable receipt generator or receipt metadata endpoint exists. |

> [!WARNING]  
> **Readiness Verdict: Backend Enhancements Required Before Frontend Implementation**  
> While the payment recording and refund lifecycles are functionally ready, the frontend **cannot build an Owner Rent Overview, Rent Charges Table, Outstanding Balance Tracker, or Tenancy Ledger** without backend API additions. Attempting to build the frontend now would force client-side fabrication of financial data, violating project rules (`AGENTS.md` Rule 2 & 5). Backend API additions are required first.

---

## 2. Answers to the 10 Audit Questions

### 1. How can an owner retrieve all rent charges across their properties?
**Current State: NOT POSSIBLE VIA REST API.**  
`apps/rent/urls.py` only exposes `PaymentViewSet` (`/api/v1/payments/`) and `RefundViewSet` (`/api/v1/refunds/`). There is no `RentChargeViewSet`, no URL route for `/api/v1/rent-charges/`, and no serializer for `RentCharge`. While `RentCharge` models exist in the database, no API client can query them.

### 2. Can charges be filtered by tenancy, property, status and billing period?
**Current State: NO.**  
Because no API endpoint exists for `RentCharge`, filtering is completely unavailable to the frontend. At the database model layer, `RentCharge` has foreign keys to `tenancy` (which links to `property`), `status` (`unpaid`, `partially_paid`, `paid`, `waived`, `cancelled`), `billing_period_start`, and `billing_period_end`. However, there are no views or DRF filter backends wired to expose these queries.

### 3. How can an owner retrieve outstanding and partially paid balances?
**Current State: NOT AVAILABLE VIA REST API.**  
There is no API endpoint that calculates or returns outstanding rent, total billed amounts, or partially paid balances for an owner or a tenancy.  
*(Note: An internal helper `get_financial_metrics()` exists in `backend/config/admin_dashboard.py`, but it is strictly an internal Django template context helper for the Django Unfold staff admin dashboard and is not accessible to regular authenticated owners via the REST API).*

### 4. How can an owner view payment history?
**Current State: FULLY IMPLEMENTED.**  
- **Endpoint:** `GET /api/v1/payments/`
- **Filtering:** Optional `?tenancy_id=<uuid>` query parameter.
- **Scope:** Calls `list_user_payments(user=request.user)`. For an owner, it returns all payments across all tenancies associated with properties they own (`Q(tenancy__property__owner=user)`).
- **Format:** Paginated response with `count`, `next`, `previous`, `results`.

### 5. How can an owner record a manual payment? What fields are required?
**Current State: FULLY IMPLEMENTED.**  
- **Endpoint:** `POST /api/v1/payments/`
- **Required Fields:**
  - `tenancy_id` (UUID): The target tenancy.
  - `amount` (Decimal, `min_value=0.01`): The payment amount.
  - `payment_method` (ChoiceField): One of `"upi"`, `"bank_transfer"`, `"card"`, `"net_banking"`, `"cash"`, `"cheque"`, `"other"`.
- **Optional Fields:**
  - `currency` (String, default `"INR"`).
  - `transaction_reference` (String, max 255 chars, unique when supplied).
  - `status` (ChoiceField, default `"completed"`, choices: `"pending"`, `"completed"`, `"failed"`).
  - `paid_at` (ISO DateTime, defaults to `timezone.now()` if status is `"completed"`).
  - `notes` (String/Text, optional description).
- **Validation:** Enforces that `tenancy` is in `active`, `confirmed`, or `ended` status, and that the requesting user is either the property owner or the tenant of that tenancy.

### 6. How are payments allocated to rent charges?
**Current State: AUTOMATIC FIFO AT SERVICE LAYER.**  
Inside `apps.rent.services.payment_service.record_payment`, whenever a payment is created with `status="completed"`, it triggers `allocate_payment_fifo(payment_id=payment.id)`:
1. Locks the `Payment` row with `select_for_update()`.
2. Computes unallocated eligible balance: `(payment.amount - completed_refunds) - effective_allocations_so_far`.
3. Selects all eligible charges for that tenancy in FIFO order: `due_date ASC`, `billing_period_start ASC`, `created_at ASC` (excluding `waived`, `cancelled`, and `paid` charges).
4. Atomically creates `PaymentAllocation` records.
5. Automatically updates the charge `status` to `paid` or `partially_paid`.
6. Any leftover amount remains unallocated on the payment record.

### 7. How can an owner retrieve payment allocations and receipts?
**Current State: NOT EXPOSED VIA REST API.**  
- **Allocations:** `PaymentSerializer` does **not** include an allocations field or nested allocation items. Furthermore, there is no `/api/v1/payments/{id}/allocations/` endpoint. As a result, the owner cannot see which specific rent charges a payment settled.
- **Receipts:** There is no receipt generator, PDF download endpoint, or formal receipt endpoint (e.g. `/api/v1/payments/{id}/receipt/`). The frontend can only construct a mock receipt display from the flat fields returned by `PaymentSerializer`.

### 8. How are refunds requested, processed and displayed?
**Current State: IMPLEMENTED PER PAYMENT.**  
- **Initiate Refund:** `POST /api/v1/payments/{payment_id}/refunds/` allows an owner or admin to create a refund.
  - Required payload: `amount`, `reason`. Optional: `refund_reference`, `status` (`completed` or `pending`).
  - If created as `status="completed"`, `execute_refund_reversals` automatically runs in reverse chronological order against prior allocations and adjusts affected charge statuses back to `partially_paid` or `unpaid`.
- **Process Pending Refund:** `POST /api/v1/refunds/{refund_id}/process/` marks a pending refund as completed and executes reversals.
- **Fail Refund:** `POST /api/v1/refunds/{refund_id}/fail/` marks a pending refund as failed without reversing allocations.
- **List Refunds:** `GET /api/v1/payments/{payment_id}/refunds/` lists refunds for a single payment.
- **Retrieve Refund:** `GET /api/v1/refunds/{refund_id}/` retrieves individual refund details with audit trail (`allocation_reversals`).
- **Limitation:** There is **no global endpoint** (`GET /api/v1/refunds/`) to view all refunds across an owner's portfolio; refunds can only be listed on a per-payment basis.

### 9. Are there APIs for tenancy-level financial summaries?
**Current State: NO.**  
Neither `apps/leasing` nor `apps/rent` provides an endpoint such as `/api/v1/tenancies/{id}/financial-summary/` or `/api/v1/tenancies/{id}/balance/`. `TenancyDetailSerializer` in `apps/leasing/serializers/tenancy.py` only returns static agreement terms (`monthly_rent`, `security_deposit`, `rent_due_day`, `start_date`, `end_date`), with no financial calculation fields.

### 10. Are all endpoints properly restricted to the authenticated owner and their own properties/tenancies?
**Current State: YES (for all existing payment and refund endpoints).**  
- `PaymentViewSet`: Calls `list_user_payments(user=request.user)`, strictly filtering by `Q(tenancy__property__owner=user) | Q(tenancy__tenant=user)`.
- `PaymentViewSet.retrieve`: Explicitly checks `_matches_user(payment.tenancy.property.owner_id, request.user)`.
- `PaymentViewSet.create`: Calls `get_tenancy_for_user()`, ensuring only the owner or tenant of that specific tenancy can record payments.
- `PaymentViewSet.refunds`: Restricts refund creation to property owners and platform admins; tenants receive HTTP 403 Forbidden.
- `RefundViewSet`: `process` and `fail` actions invoke `_verify_user_can_manage_refunds()`, returning HTTP 403 Forbidden for non-owners.

---

## 3. API Contract Inventory

### 3.1 Implemented Endpoints

#### 1. List Payments
- **Method & URL:** `GET /api/v1/payments/`
- **Purpose:** Retrieve all payments for the authenticated user's portfolio or a specific tenancy.
- **Parameters:**
  - `tenancy_id` (Query, UUID, optional): Filter by tenancy.
  - `page` (Query, Integer, optional, default 1).
  - `page_size` (Query, Integer, optional, default 20, max 100).
- **Permissions:** `IsAuthenticated`.
- **Response Structure:**
  ```json
  {
    "count": 42,
    "next": "http://localhost:8000/api/v1/payments/?page=2",
    "previous": null,
    "results": [
      {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "tenancy": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
        "property_title": "Greenfield Villa",
        "tenant_name": "John Doe",
        "amount": "15000.00",
        "currency": "INR",
        "payment_method": "upi",
        "payment_method_display": "UPI",
        "transaction_reference": "UPI-1234567890",
        "status": "completed",
        "paid_at": "2026-11-01T10:30:00Z",
        "notes": "November rent payment",
        "created_at": "2026-11-01T10:30:00Z",
        "updated_at": "2026-11-01T10:30:05Z"
      }
    ]
  }
  ```
- **Error Responses:** 401 Unauthorized, 403 Forbidden (if unauthorized tenancy requested), 404 Not Found.
- **Implementation Status:** **Implemented**.

#### 2. Record Payment
- **Method & URL:** `POST /api/v1/payments/`
- **Purpose:** Record a verified or manual payment for an authorized tenancy.
- **Request Body (`application/json`):**
  ```json
  {
    "tenancy_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "amount": "15000.00",
    "payment_method": "bank_transfer",
    "currency": "INR",
    "transaction_reference": "TXN-987654321",
    "status": "completed",
    "paid_at": "2026-11-01T12:00:00Z",
    "notes": "Direct NEFT transfer verified"
  }
  ```
- **Permissions:** `IsAuthenticated` (Must be property owner, tenant, or admin).
- **Response Structure (201 Created):**
  ```json
  {
    "success": true,
    "message": "Payment recorded successfully.",
    "data": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "tenancy": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "property_title": "Greenfield Villa",
      "tenant_name": "John Doe",
      "amount": "15000.00",
      "currency": "INR",
      "payment_method": "bank_transfer",
      "payment_method_display": "Bank Transfer",
      "transaction_reference": "TXN-987654321",
      "status": "completed",
      "paid_at": "2026-11-01T12:00:00Z",
      "notes": "Direct NEFT transfer verified",
      "created_at": "2026-11-01T12:00:00Z",
      "updated_at": "2026-11-01T12:00:00Z"
    }
  }
  ```
- **Error Responses:** 400 Bad Request (invalid choices, non-positive amount, duplicate transaction_reference), 401 Unauthorized, 403 Forbidden, 404 Not Found.
- **Implementation Status:** **Implemented**.

#### 3. Retrieve Payment Details
- **Method & URL:** `GET /api/v1/payments/{id}/`
- **Purpose:** Retrieve details of a single payment record.
- **Permissions:** `IsAuthenticated` (Owner, tenant, or admin).
- **Response Structure (200 OK):** Wrapped in `{"success": true, "data": { ... }}` containing `PaymentSerializer` fields.
- **Error Responses:** 401 Unauthorized, 403 Forbidden, 404 Not Found.
- **Implementation Status:** **Implemented**.

#### 4. List Payment Refunds
- **Method & URL:** `GET /api/v1/payments/{payment_id}/refunds/`
- **Purpose:** List all refunds issued against a specific payment.
- **Permissions:** `IsAuthenticated` (Owner, tenant, or admin).
- **Response Structure (200 OK):** Paginated results list of `PaymentRefundSerializer` objects.
- **Implementation Status:** **Implemented**.

#### 5. Create Payment Refund
- **Method & URL:** `POST /api/v1/payments/{payment_id}/refunds/`
- **Purpose:** Issue a full or partial refund against a completed payment.
- **Request Body (`application/json`):**
  ```json
  {
    "amount": "5000.00",
    "reason": "Security deposit deduction adjustment",
    "currency": "INR",
    "refund_reference": "REF-554433",
    "status": "completed"
  }
  ```
- **Permissions:** `IsAuthenticated` (Must be property owner or platform admin; tenants receive 403).
- **Response Structure (201 Created):**
  ```json
  {
    "success": true,
    "message": "Refund processed successfully.",
    "data": {
      "id": "e4b6c310-9189-4e78-9f12-0761e2a912bb",
      "payment": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "amount": "5000.00",
      "currency": "INR",
      "reason": "Security deposit deduction adjustment",
      "status": "completed",
      "refund_reference": "REF-554433",
      "processed_at": "2026-11-05T14:22:00Z",
      "created_by": "1f8e3290-77a8-4bb9-b7b5-7798daef8789",
      "created_by_name": "Property Owner",
      "allocation_reversals": [
        {
          "id": "893d11b2-29ff-4927-9be7-1339bc077b55",
          "allocation": "6b3e7781-8172-46fa-9087-7341ad9c3b12",
          "rent_charge": "a12b4567-c890-4def-1234-56789abcdef0",
          "reversed_amount": "5000.00",
          "created_at": "2026-11-05T14:22:00Z"
        }
      ],
      "created_at": "2026-11-05T14:22:00Z",
      "updated_at": "2026-11-05T14:22:00Z"
    }
  }
  ```
- **Error Responses:** 400 Bad Request (refund amount exceeds refundable balance), 401 Unauthorized, 403 Forbidden, 404 Not Found.
- **Implementation Status:** **Implemented**.

#### 6. Process Pending Refund
- **Method & URL:** `POST /api/v1/refunds/{refund_id}/process/`
- **Purpose:** Execute allocation reversals and finalize a pending refund.
- **Request Body:** `{"refund_reference": "REF-PROCESSED-123"}` (optional).
- **Permissions:** `IsAuthenticated` (Owner or admin).
- **Implementation Status:** **Implemented**.

#### 7. Fail Pending Refund
- **Method & URL:** `POST /api/v1/refunds/{refund_id}/fail/`
- **Purpose:** Mark a pending refund as failed without executing reversals.
- **Request Body:** `{"reason": "Bank transfer rejected"}` (optional).
- **Permissions:** `IsAuthenticated` (Owner or admin).
- **Implementation Status:** **Implemented**.

---

### 3.2 Missing Endpoints (Gaps)

| Missing Endpoint | Target Purpose | Needed By Frontend Screen |
|---|---|---|
| `GET /api/v1/rent-charges/` | List, filter, and paginate rent charges across owner's properties or by tenancy. | **Rent Charges Table**, Overdue Tracker |
| `GET /api/v1/rent-charges/{id}/` | Retrieve specific charge with breakdown of allocated payments and effective balance. | **Charge Breakdown / Invoice View** |
| `GET /api/v1/rent/summary/` | Portfolio-level financial summary (Total Billed, Total Collected, Outstanding, Overdue). | **Owner Rent Overview / Dashboard KPI** |
| `GET /api/v1/tenancies/{id}/financial-summary/` | Tenancy-level financial ledger (Current Balance, Unallocated Payments, Next Due Date). | **Tenancy Detail Financial Tab** |
| `GET /api/v1/payments/{id}/allocations/` | List rent charges settled by a specific payment. | **Payment Details & Allocations Breakdown** |
| `GET /api/v1/payments/{id}/receipt/` | Fetch receipt data or download generated PDF receipt. | **Payment Receipt Modal / Download** |
| `GET /api/v1/refunds/` | Portfolio-wide refund list for an owner. | **Refund History Tab** |

---

## 4. Gap Analysis by Frontend Feature

### 4.1 Owner Rent Overview & Dashboard Metrics
- **Frontend Need:** Summary cards showing: Total Collections (Month / All-Time), Outstanding Rent, Overdue Amount, and Count of Unpaid Charges.
- **Backend Reality:** **MISSING**. No endpoint exists. `GET /api/v1/payments/` only returns payments. Computing outstanding rent on the client side is impossible because rent charges are not exposed.

### 4.2 Rent Charges Table
- **Frontend Need:** Filterable, paginated table of rent charges displaying: Tenancy / Property Title, Tenant Name, Charge Type (`rent`, `security_deposit`, etc.), Billing Period, Due Date, Amount, Amount Paid, and Status (`unpaid`, `partially_paid`, `paid`, `overdue`).
- **Backend Reality:** **MISSING**. No `RentChargeViewSet` or `/api/v1/rent-charges/` endpoint exists in Django.

### 4.3 Tenancy-Level Financial History & Ledger
- **Frontend Need:** Inside `/app/owner/tenancies/:id`, a dedicated financial section showing: Tenancy Balance, Total Charged, Total Paid, Next Due Date, and Combined Ledger of Charges & Payments.
- **Backend Reality:** **MISSING**. `TenancyDetailSerializer` has zero financial summary fields, and charges cannot be fetched.

### 4.4 Manual Payment Recording
- **Frontend Need:** Modal/form allowing owners to record offline payments (Cash, Cheque, Bank Transfer, UPI).
- **Backend Reality:** **READY & IMPLEMENTED**. `POST /api/v1/payments/` fully supports this workflow with automatic FIFO allocation.

### 4.5 Payment History Table
- **Frontend Need:** Paginated list of payments with date, tenant, property, amount, method, status, reference.
- **Backend Reality:** **READY & IMPLEMENTED**. `GET /api/v1/payments/` provides all required fields.

### 4.6 Payment Allocation Breakdown & Receipt
- **Frontend Need:** When viewing a payment, inspect which rent charges were settled and print/download a formal payment receipt.
- **Backend Reality:** **MISSING**. `PaymentSerializer` does not include allocations, and no receipt generator endpoint exists.

### 4.7 Refund Workflow
- **Frontend Need:** Initiate a refund against a payment, process pending refunds, and view refund status.
- **Backend Reality:** **PARTIALLY READY**. Per-payment refund operations (`POST /api/v1/payments/{id}/refunds/`, `POST /api/v1/refunds/{id}/process/`) are complete. However, there is no global list of refunds across all tenancies for an owner.

---

## 5. Technical Recommendations & Backend Action Plan

To enable the frontend team to build the Owner Rent & Payments module cleanly without workarounds or fake data, the following backend additions are recommended before frontend development starts:

### Step 1: Create `RentChargeSerializer` and `RentChargeViewSet`
- **Location:** `backend/apps/rent/serializers/rent_charge.py` & `backend/apps/rent/views/rent_charge.py`.
- **Route:** `router.register("rent-charges", RentChargeViewSet, basename="rent-charge")` in `apps/rent/urls.py`.
- **Queryset:** `RentCharge.objects.filter(tenancy__property__owner=request.user)`.
- **Filter Backends:** Filter by `tenancy_id`, `property_id`, `status`, `charge_type`, `due_date__gte`, `due_date__lte`.
- **Annotations/Methods:** Include `amount_paid` (effective allocations) and dynamic `is_overdue`.

### Step 2: Implement Financial Summary Endpoint
- **Route:** `GET /api/v1/rent/summary/` (or action on `RentChargeViewSet` `@action(detail=False, methods=["get"])`).
- **Output:**
  ```json
  {
    "total_billed": "450000.00",
    "total_collected": "420000.00",
    "total_refunded": "5000.00",
    "net_collections": "415000.00",
    "outstanding_rent": "30000.00",
    "overdue_rent": "15000.00",
    "unpaid_charges_count": 2,
    "overdue_charges_count": 1
  }
  ```
  *(Can reuse the exact calculation logic from `get_financial_metrics` in `backend/config/admin_dashboard.py` scoped to `tenancy__property__owner=request.user`).*

### Step 3: Expose Payment Allocations
- Update `PaymentSerializer` (or add a nested serializer / sub-endpoint `GET /api/v1/payments/{id}/allocations/`) to return the `PaymentAllocation` records associated with the payment.

---

## Summary of Findings

1. **What is already working:** The payment recording pipeline (`POST /api/v1/payments/`), payments history (`GET /api/v1/payments/`), FIFO allocation engine, and refund reversal lifecycle are fully functional and tested.
2. **The critical blocker:** There are **zero API endpoints** to query rent charges (`RentCharge`) or financial aggregates (outstanding balances, total billed, overdue amounts).
3. **Verdict:** The backend requires a lightweight enhancement (exposing `RentChargeViewSet` and a portfolio financial summary endpoint) before the frontend Owner Rent & Payments module can be implemented.

