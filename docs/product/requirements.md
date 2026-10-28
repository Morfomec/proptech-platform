# Product Requirements Document (PRD)

## 1. Product Overview
The platform is a residential rental solution that bridges rental discovery and property management within a single unified system. It combines:
1. **A Rental Marketplace**: Enabling prospective tenants to browse, search, and submit applications for rental units.
2. **A Property Management System**: Allowing property owners to manage properties, individual units, tenancies, agreed rents, and track rent charges and payments.
3. **An AI Assistant**: Assisting owners by generating editable rental listing descriptions to streamline the listing creation process.

The platform is designed as a modular monolith (Django REST Framework backend, PostgreSQL database, and React + TypeScript frontend) to start lean while establishing a clean foundation for future growth.

---

## 2. Problem Statement
The residential rental process is frequently fragmented across disconnected tools. Landlords and property owners often use one platform to advertise listings, separate communication channels to collect applications, and spreadsheets or manual records to manage tenancies and track rent payments. Crafting compelling listing copy is also time-consuming. Prospective tenants face disjointed application experiences without a centralized way to track their application status or view their tenancy and payment records.

---

## 3. Target Users
- **Property Owners (Landlords / Managers)**: Individuals managing residential properties and rental units who need to market vacancies, screen applicants, and manage ongoing tenancies.
- **Tenants (Applicants / Residents)**: Individuals seeking residential rental housing, applying for units, and tracking their tenancies and payment histories.
- **Platform Administrators**: Internal operators responsible for platform oversight, user management, and system governance.

---

## 4. MVP Features

### 4.1 Authentication & Role-Based Access Control
- Secure user registration, login, and session management.
- Role-based authorization enforcing permissions across Owner, Tenant, and Admin roles.

### 4.2 Property & Unit Management
- Ability for owners to add, view, update, and manage properties.
- Management of individual rental units associated with properties (e.g., unit details, specs, and status).

### 4.3 Rental Listings & Discovery
- Creation and editing of rental listings linked to specific units.
- Listing lifecycle management: draft, publish, and unpublish listings.
- Public search and browse capabilities for tenants to view active listings with relevant details.

### 4.4 AI-Generated Listing Descriptions
- AI-assisted draft generation for rental listing descriptions based on unit and property attributes.
- Full editing capability for owners to review and adjust AI-generated copy before publishing.
- Flexible AI integration layer allowing provider selection to remain modular.

### 4.5 Rental Applications
- Tenants can submit rental applications for published listings.
- Owners can review incoming applications and update status (e.g., approve or reject applicants).
- Tenants can track the status of their submitted applications.

### 4.6 Tenancy Management
- Creation of tenancy agreements upon applicant approval, defining tenancy terms and agreed rent.
- Overview of active tenancy information accessible to both the owner and the assigned tenant.

### 4.7 Rent Charges & Payment Records
- Owners can generate rent charges for active tenancies.
- Owners can log and record manual rent payments.
- Tenants can view their rent charges, balance, and historical payment records.

---

## 5. User Roles and Permissions

| Role | Key Permissions & Capabilities |
| :--- | :--- |
| **Owner** | • Create and manage properties and rental units.<br>• Create, edit, publish, and unpublish listings.<br>• Generate and edit AI listing descriptions.<br>• Review applications and approve or reject applicants.<br>• Create and manage tenancies and agreed rent terms.<br>• Issue rent charges and record manual payments received. |
| **Tenant** | • Browse, search, and view published listing details.<br>• Submit rental applications.<br>• View application status and active tenancy details.<br>• View rent charges, dues, and payment history. |
| **Admin** | • Superuser platform oversight and management.<br>• Access restricted to Django Admin interface for operational governance. |

---

## 6. Out of Scope (MVP)
The following capabilities are deliberately excluded from the MVP scope:
- **Online Payment Processing**: No direct gateway integrations (e.g., Stripe, PayPal); payments are recorded manually.
- **Identity Verification & Background Checks**: No third-party KYC or credit scoring integrations.
- **In-App Messaging / Chat**: No direct real-time communication tools between owners and tenants.
- **Advanced AI Matching & Recommendations**: No automated tenant-property scoring algorithms.
- **Trust & Reputation Scoring**: No rating or review systems.
- **Complex Organization & Multi-Seat Management**: No multi-member team hierarchy or enterprise permissions.

---

## 7. Success Criteria
1. **End-to-End Workflow Completion**: An owner can list a unit with an AI-generated description, receive a tenant application, approve it, establish a tenancy, and record rent charges/payments.
2. **Accurate Role Segregation**: Tenant and Owner views and data access are strictly partitioned by authorization rules.
3. **Editorial Control Over AI**: 100% of AI-generated listing copy can be reviewed and edited prior to publication.
4. **Reliable Financial Tracking**: All rent charges and recorded manual payments accurately reflect on tenant and owner dashboards.
5. **Clean Architectural Baseline**: REST API is completely specified via OpenAPI documentation, supporting the React frontend on top of a modular Django backend.

---

## 8. Future Expansion
- Integrated digital payment gateways for automated rent collection and disbursements.
- Built-in tenant screening, identity verification, and credit check integrations.
- In-platform messaging and maintenance request tracking.
- Advanced tenant-to-property matching algorithms and recommendation engines.
- Multi-user property management organizations, role delegation, and portfolio reporting.
- Native mobile applications for on-the-go property management and tenant portals.
