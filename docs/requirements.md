# Product Requirements Document (PRD)

## 1. Product Overview
A rental marketplace and property management platform:
1. **Rental Marketplace**: Tenants search listings and submit applications.
2. **Property Management**: Owners manage properties, tenancies, rent charges, payments, and subscriptions.
3. **AI Assistant**: Generates editable listing description drafts for owners based on property specifications.

**Architecture**: Modular monolith with Django + Django REST Framework, PostgreSQL, and React + TypeScript.

---

## 2. Problem Statement
Rental workflows are fragmented across separate listing sites, communication tools, and spreadsheets. Creating listings is tedious, application tracking is disjointed, and recording rent is largely manual.

---

## 3. Target Users
- **Owner**: Manages properties (residential and commercial), subscription quotas, listings, applications, tenancies, rental agreements, and rent records.
- **Tenant**: Searches listings, saves favorite properties, submits applications, and tracks tenancies and rent payment history.
- **Admin**: Oversees platform operations, user moderation, and listing reviews via Django Admin.

---

## 4. MVP Features
1. **Authentication & Authorization**: Role-based access control for Owner, Tenant, and Admin using custom email authentication and Google OAuth 2.0 (`social_accounts`).
2. **Property Management**: Property-centric architecture where one property is one independently rentable asset. Supports residential and commercial categories and types, address coordinates, photo gallery, and catalogued amenities.
3. **Subscriptions & Quota Management**: Owner subscription plans (Starter, Growth, Pro, Enterprise), active subscription lifecycle, trial duration tracking, and transactional property quota enforcement (locking the owner or subscription row, counting owned properties, validating against plan quota, and creating the property within the same transaction).
4. **Listing Management & Discovery**: Create, edit, publish, and unpublish listings; moderation workflows; public search and filtering; bookmarking via saved properties.
5. **AI Listing Descriptions**: Generate draft descriptions from verified property specifications; owner edits before publishing.
6. **Rental Applications**: Tenants apply directly to listings; append-only application status history; owners review, approve, or reject.
7. **Tenancy Management**: Convert approved applications into active tenancies with agreed contract terms; date overlap protection via PostgreSQL exclusion constraints; attach rental agreement documents.
8. **Rent & Payment Tracking**: Record rent charges, log manual payments, track payment refunds, allocate payments to charges, and view balance ledgers.

---

## 5. User Roles and Permissions

| Role | Permissions |
| :--- | :--- |
| **Owner** | Manage properties within subscription plan quotas; manage listings; generate/edit AI copy; review/approve applications; manage tenancies and attached agreement documents; issue rent charges, record manual payments, and track refunds. |
| **Tenant** | Browse and search listings; save properties; submit rental applications; view application status history; view tenancy details, rent charges, and payment records. |
| **Admin** | Full system oversight, listing moderation, user management, and administration via Django Admin. |

---

## 6. Out of Scope (MVP)
- Automated online payment gateway processing (manual payment logging only)
- Automated tenant background checks and identity verification
- In-app messaging and real-time chat
- Advanced AI matching and recommendation algorithms
- Trust and reputation scoring
- Multi-seat organization management

---

## 7. Success Criteria
1. **End-to-End Flow**: Owner creates property within subscription quota, lists property with AI copy, approves tenant application, creates tenancy with attached agreement document, and logs rent payment.
2. **Role Isolation**: Strict access controls separating Owner, Tenant, and Admin views and data.
3. **Editable AI Output**: All AI-generated text is editable prior to publishing.
4. **Accurate Ledgers**: Rent charges, recorded payments, and payment allocations reflect accurately for both owner and tenant.
5. **Documented REST API**: Backend API fully specified with OpenAPI for the React frontend.

---

## 8. Future Expansion
- Payment gateway integration (automated rent collection)
- Tenant screening and identity verification
- In-app messaging and maintenance requests
- AI-based tenant matching
- Multi-user organization management
- Mobile applications

