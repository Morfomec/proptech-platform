# PropTech Platform — Project Time Planning & Execution Strategy

This document establishes the official 3-week execution roadmap, weekly development milestones, and deliverable verification criteria for the PropTech Platform modular monolith application.

---

## 1. Roadmap Overview & Timeline

The implementation is structured into three one-week iterative development cycles:

| Milestone | Core Theme | Target Scope | Key Deliverable |
| :--- | :--- | :--- | :--- |
| **Week 1** | Identity, Access & Property Catalog | Accounts, RBAC, Properties, Listings & Public Marketplace | Authenticated owners can manage properties and publish listings; tenants can search and save properties. |
| **Week 2** | Leasing Pipeline & Tenancies | Applications, Status History, Tenancies & Document Management | Tenants can apply for properties; owners can review, approve, and establish tenancies with attached agreements. |
| **Week 3** | Financial Ledger, Monetization & Operations | Rent Charges, Payments, Refunds, Subscriptions, Admin & Deployment | Full financial ledger, owner SaaS subscription quota enforcement, admin operations, and production deployment. |

---

# Week 1 – Authentication, Authorisation & Property Listings

### Backend Development

#### 1. Authentication
- User registration and login (Email + Password).
- JWT access and refresh token issuing, verification, and rotation.
- Secure logout and token invalidation handling.
- Password reset workflow.
- Email verification lifecycle and verification link expiration (24-hour validity).
- Google OAuth 2.0 social authentication and secure account linking via `social_accounts`.

#### 2. Authorisation
- Role-Based Access Control (RBAC) supporting **Owner**, **Tenant**, and **Admin** personas.
- Role-based API permission classes on all endpoints.
- Object-level permissions ensuring owners can only modify their own properties, listings, and tenancies.
- Strict tenant authorization restricting access to permitted applications, lease records, and receipts.

#### 3. Property Management
- CRUD operations for properties as independent rentable assets (property-centric architecture).
- Residential (`independent_house`, `villa`, `apartment`, `studio_apartment`, `other`) and commercial (`office`, `shop`, `showroom`, `warehouse`, `other`) categorization and property types.
- Address specifications, locality hierarchy, and map coordinates (`latitude`, `longitude`).
- Authoritative property photo gallery (`property_images`) with single primary image enforcement (`is_primary=true`).
- Centralized amenities catalogue and property tagging (`property_amenities`).
- Comprehensive property validation rules (physical specs, coordinate validation prior to publication).

#### 4. Listing Management
- Create, update, publish, pause, and close rental listings (`listings`).
- Asking terms: monthly rent, security deposit, and available-from date.
- Publication approval and listing review workflow (`review_status`).
- Public marketplace search, location filtering, and listing detail queries.
- Tenant saved properties and bookmarking functionality (`saved_properties`).

### Frontend Development

- Registration and login user interfaces.
- Forgot password and password reset screens.
- Email verification pending and confirmation screens.
- Role-based navigation headers and client-side protected routes.
- Owner property dashboard foundation.
- Add / Edit Property multi-step form (residential & commercial categories, amenities checklist).
- Property photo gallery upload and primary image selector.
- Property listing management studio.
- Tenant Browse Rentals marketplace page with filtering drawers.
- Property detail view with specifications, photo carousel, and amenities.
- Save property toggle button and saved properties page.

### Week 1 Deliverable

> [!IMPORTANT]
> **Week 1 Verification Criteria:**
> 1. A user can register, log in, and access the appropriate dashboard interface based on their assigned role.
> 2. An owner can create and manage properties, upload photos, select amenities, and publish rental listings.
> 3. A tenant can browse, filter, search, and save available rental properties.

---

# Week 2 – Applications, Tenancies & Documents

### Backend Development

#### 1. Rental Applications
- Submit rental applications directly against open listings (`applications`).
- Retrieve submitted applications for applicants and received applications for owners.
- Owner application management pipeline (review, approve, reject).
- Append-only application status transition history (`application_status_history`).
- Application validation rules: prevent duplicate applications by the same applicant on the same listing, and reject submissions on paused or closed listings.

#### 2. Tenancy Management
- Convert an approved rental application into an active tenancy (`tenancies`).
- Tenancy details retrieval and contract term management (`monthly_rent`, `security_deposit`, `rent_due_day`).
- Tenancy status transitions (`pending`, `confirmed`, `active`, `ended`, `cancelled`).
- Check-in and move-in date tracking (`actual_move_in_date`).
- Move-out, checkout, and tenancy completion tracking (`actual_move_out_date`).
- Prevent overlapping tenancies on the same property using PostgreSQL exclusion constraints (`excl_tenancy_property_no_overlap`).
- Update property occupancy and availability status atomically.

#### 3. Documents
- Centralized file upload and metadata tracking (`documents`).
- Secure file retrieval, authorization validation, and signed URL generation.
- Associate documents with parent entities: properties, applications, or tenancies (enforced via single-parent check constraint).
- Store signed rental agreements as tenancy-linked documents (`document_type = 'rental_agreement'`).

#### 4. Notifications
- Application submission and status update notifications for owners and applicants.
- Tenancy creation and activation notifications.
- Basic in-app notification list and read tracking (`notifications`).

### Frontend Development

- Tenant "My Applications" tracking page.
- Application submission modal with tenant message input.
- Application status progression tracker (Submitted → Under Review → Approved / Rejected).
- Owner "Applications Management" dashboard pipeline.
- Application review card with applicant details and Approve/Reject action buttons.
- Tenant and Owner Tenancy overview pages.
- Tenancy details, move-in/out scheduling, and status management.
- Centralized document upload and download interface.
- Tenancy rental agreement viewing and download section.
- Header notification bell and notification flyout panel.

### Week 2 Deliverable

> [!IMPORTANT]
> **Week 2 Verification Criteria:**
> 1. A tenant can apply for a published property listing and track the application status in real time.
> 2. An owner can review incoming applications, approve or reject them, and convert approved applicants into formal tenancies.
> 3. Both owner and tenant can access agreed tenancy terms and view attached rental agreement documents.

---

# Week 3 – Rent, Payments, Subscriptions, Admin & Deployment

### Backend Development

#### 1. Rent Management
- Automatic and scheduled rent charge generation (`rent_charges`).
- Billing period calculations (`billing_period_start`, `billing_period_end`) and due dates.
- Outstanding balance tracking across active tenancies.
- Rent ledger history retrieval for owners and tenants.
- Manual payment logging for offline cash, bank transfer, or cheque receipts (`payments`).

#### 2. Payments & Refunds
- Record, retrieve, and inspect payment transactions.
- Transactional payment allocation service settling rent charges (`payment_allocations`) with composite foreign key integrity.
- Historical payment receipts and audit trail.
- Refund recording, validation, and balance adjustments (`payment_refunds`).
- Payment gateway integration hooks (prepared for automated processing post-MVP).

#### 3. Subscriptions
- Catalogue and list owner SaaS subscription tiers (`subscription_plans`: Starter, Growth, Pro, Enterprise).
- Manage active owner subscriptions (`subscriptions`).
- Transactional property quota enforcement: lock owner/subscription row, count owned properties, validate against plan limits, and create property within the same transaction.
- Retrieve subscription quota utilization and billing period dates.
- Subscription payment recording (`subscription_payments`).
- Basic plan upgrade and renewal workflow.

#### 4. Admin & Dashboards
- Administrator overview endpoints and system summary metrics.
- User management and account moderation via Django Admin.
- Property and listing review/moderation queue (`review_status`).
- Platform subscription revenue and quota monitoring.
- Owner operational dashboard metrics (occupancy, active tenancies, total monthly collections, pending dues).
- Tenant personal dashboard metrics (upcoming rent due date, active tenancies, application statuses).

### Frontend Development

- Owner Rent Management dashboard and ledger.
- Rent charge schedules and payment transaction history tables.
- Record Manual Payment modal with payment method and reference fields.
- Printable/downloadable payment receipt view.
- Tenant Rent & Payments history page with outstanding balance indicator.
- Subscription plans comparison and pricing tier cards.
- Owner Subscription & Billing management page with quota progress bar.
- Admin portal interfaces for user moderation, listing reviews, and subscription monitoring.
- Final UI polish, responsive design refinements, and empty-state illustrations.

### Testing & Deployment

- Backend API integration test suites (DRF APIClient tests for auth, properties, leasing, rent, subscriptions).
- Role and permission validation (RBAC positive and negative test cases).
- Complete owner-to-tenant rental lifecycle end-to-end testing.
- Financial integrity tests (payment allocation conservation, refund ceiling validation).
- Subscription quota boundary and concurrency race condition testing.
- Frontend user journey and integration testing.
- Critical bug fixing and security review (environment isolation, CORS, HTTPS headers).
- Production deployment (PostgreSQL provisioning, static assets, reverse proxy setup).
- API contract documentation finalization and project presentation walkthrough.

### Week 3 Deliverable

> [!IMPORTANT]
> **Week 3 Verification Criteria:**
> 1. The complete rental lifecycle is operational: rent charges are issued, manual payments are recorded, refunds are tracked, and balances calculate accurately.
> 2. Owner subscription tiers and transactional property quotas are enforced.
> 3. Administrative moderation and operational dashboards are functional.
> 4. The complete, integrated PropTech MVP is deployed and ready for demonstration.

---

## 2. Alignment with Architectural Specifications

This execution strategy directly fulfills the requirements documented in:
* **Product Scope & Requirements**: [`docs/requirements.md`](requirements.md)
* **Master System Blueprint**: [`docs/final-system-blueprint.md`](final-system-blueprint.md)
* **Database Architecture & ERD**: [`docs/database-design.md`](database-design.md) & [`docs/diagrams/database-erd.version.02.dbml`](diagrams/database-erd.version.02.dbml)
* **Module Boundaries & Table Ownership**: [`docs/module-boundaries.md`](module-boundaries.md)
* **API Documentation & Contracts**: [`docs/api/README.md`](api/README.md)
* **UI/UX Design Tokens & Flows**: [`docs/design/figma.md`](design/figma.md)
