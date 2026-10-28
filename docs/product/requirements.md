# Product Requirements Document (PRD)

## 1. Product Overview
A residential rental platform uniting discovery and property management:
1. **Rental Marketplace**: Tenants search listings and submit applications.
2. **Property Management**: Owners manage properties, units, tenancies, rent charges, and payments.
3. **AI Assistant**: Generates editable listing description drafts for owners.

**Architecture**: Modular monolith with Django + Django REST Framework, PostgreSQL, and React + TypeScript.

---

## 2. Problem Statement
Rental workflows are fragmented across separate listing sites, communication tools, and spreadsheets. Creating listings is tedious, application tracking is disjointed, and recording rent is largely manual.

---

## 3. Target Users
- **Owner**: Manages properties, units, listings, applications, tenancies, and rent records.
- **Tenant**: Searches listings, submits applications, and tracks tenancies and rent history.
- **Admin**: Oversees platform operations via Django Admin.

---

## 4. MVP Features
1. **Authentication & Authorization**: Role-based access control for Owner, Tenant, and Admin.
2. **Property & Unit Management**: Add, update, and manage properties and rental units.
3. **Listing Management & Discovery**: Create, edit, publish, and unpublish listings; public search and browse for tenants.
4. **AI Listing Descriptions**: Generate draft descriptions from unit attributes; owner edits before publishing.
5. **Rental Applications**: Tenants apply to listings; owners review, approve, or reject.
6. **Tenancy Management**: Create tenancies from approved applications with agreed rent and dates.
7. **Rent & Payment Tracking**: Record rent charges and log manual payments; view payment history and balances.

---

## 5. User Roles and Permissions

| Role | Permissions |
| :--- | :--- |
| **Owner** | Manage properties, units, and listings; generate/edit AI copy; review/approve applications; manage tenancies; issue charges and record manual payments. |
| **Tenant** | Browse and search listings; submit applications; view application status; view tenancy details, rent charges, and payment records. |
| **Admin** | Full system oversight and administration via Django Admin. |

---

## 6. Out of Scope (MVP)
- Online payment processing (manual payment logging only)
- Identity verification and background checks
- In-app messaging and chat
- Advanced AI matching and recommendation algorithms
- Trust and reputation scoring
- Multi-seat organization management

---

## 7. Success Criteria
1. **End-to-End Flow**: Owner lists unit with AI copy, approves tenant application, creates tenancy, and logs rent payment.
2. **Role Isolation**: Strict access controls separating Owner, Tenant, and Admin views and data.
3. **Editable AI Output**: All AI-generated text is editable prior to publishing.
4. **Accurate Ledgers**: Rent charges and recorded payments reflect accurately for both owner and tenant.
5. **Documented REST API**: Backend API fully specified with OpenAPI for the React frontend.

---

## 8. Future Expansion
- Payment gateway integration (automated rent collection)
- Tenant screening and identity verification
- In-app messaging and maintenance requests
- AI-based tenant matching
- Multi-user organization management
- Mobile applications
