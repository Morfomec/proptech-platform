# Master System Blueprint: PropTech Platform

## 1. Overview

The PropTech platform is a residential rental marketplace and property-management application. It connects tenants searching for homes with owners managing properties, listings, applications, tenancies, and rent records.

**Primary goal:** Deliver a focused three-week MVP using a modular monolith rather than distributed microservices.

**Target users:** Property owners, tenants, and administrators.

## 2. MVP Scope

The MVP includes:
- User authentication and role-based access for Owners, Tenants, and Admins.
- Property and unit management.
- Rental listing creation, publication, search, and discovery.
- AI-assisted listing-description drafts, reviewed and edited by owners.
- Rental applications and owner review.
- Tenancy creation from approved applications.
- Rent charges, manual payment records, allocations, and balances.

**Out of scope:** Online payment processing, identity verification, tenant screening, in-app chat, advanced AI recommendations, and multi-seat organizations.

Source of truth: [Product Requirements](requirements.md).

## 3. System Architecture

The platform uses a React + TypeScript single-page frontend, a Django REST Framework backend, and one PostgreSQL database. The backend is a modular monolith: its domain modules run in one application and communicate through Python service functions.

The frontend calls the backend over HTTPS using REST APIs. The AI module calls an external provider over HTTPS. Property images and documents use file storage, with local storage for development and private object storage planned for production.

See [System Architecture](system-architecture.md) for the architecture diagram, request flows, infrastructure, and security decisions.

## 4. Backend Modules

The backend is divided into nine modules:

| Module | Responsibility |
|---|---|
| accounts | Identity, authentication, profiles, and roles |
| properties | Properties, units, images, and saved properties |
| listings | Rental listings, publication, and search |
| leasing | Applications, application history, and tenancies |
| rent | Rent charges, payments, allocations, and balances |
| ai_assistant | External AI provider integration for draft descriptions |
| notifications | In-app notifications |
| audit_logs | Audit trail for important actions |
| documents | File metadata and access rules |

Each module owns its data and exposes service functions for cross-module operations. The detailed ownership and dependency rules are documented in [Module Boundaries](module-boundaries.md).

## 5. Database Design

The data model contains 17 tables covering accounts, properties, listings, leasing, rent, and supporting capabilities.

- [Database design overview](database-design.md)
- [Editable ERD source](diagrams/database-erd.dbml)
- [ERD image](diagrams/database-erd.png)

**Status: Final validation still required.** Before Django model implementation, verify that the committed DBML, database-design.md, and ERD image agree. Confirm the composite foreign-key requirements for payment allocations, the final unit bathroom and postal-code field types, the email-based custom user model decision, and the partial unique indexes to be implemented in Django migrations. Regenerate the ERD image after the source schema is finalized.

## 6. API Design

The backend will expose REST APIs using Django REST Framework, with an OpenAPI specification for frontend integration.

**Status: Pending.** Endpoint paths, methods, permissions, and request/response schemas have not yet been finalized.

## 7. AI Integration

The only AI feature in the MVP is generating a draft rental-listing description from supplied property and unit facts.

The draft is returned to the owner for review and editing. The AI module cannot save or publish a listing. Provider configuration, prompt construction, validation, timeouts, and error handling are isolated in the ai_assistant module.

See [AI Integration](ai-integration.md) for its processing flow and safeguards.

## 8. Key User Workflow

1. An owner creates a property and one or more units.
2. The owner drafts a listing and may request AI-generated description text.
3. The owner reviews the text and saves or publishes the listing.
4. A tenant searches listings and submits an application.
5. The owner reviews the application and approves or rejects it.
6. An approved application can be used to create a tenancy.
7. The owner records rent charges and manual payments; the system tracks allocations and balances.

Multi-step operations such as tenancy creation and payment allocation must use database transactions and validate permissions and business rules.

## 9. Security and Reliability Principles

- Enforce role and resource-ownership checks on every relevant endpoint.
- Keep database credentials, Django secrets, and AI provider keys on the server.
- Validate request data before business operations.
- Keep tenant documents private and authorize every file access.
- Use transactions for multi-record workflows and financial allocations.
- Treat AI output as untrusted draft text and provide manual fallback if the provider is unavailable.
- Do not send credentials, tenant identities, or payment details to the AI provider.

## 10. Requirement Status

| Requirement | Status | Deliverable |
|---|---|---|
| 1. Product scope and modules | Complete | requirements.md |
| 2. UI/UX design | Pending | Wireframes and Figma designs |
| 3. High-level architecture | Complete | system-architecture.md |
| 4. Service/system breakdown | Complete | module-boundaries.md |
| 5. Database design | In progress | database-design.md and diagrams |
| 6. API design | Pending | Endpoint and OpenAPI specification |
| 7. Communication and infrastructure | Documented | system-architecture.md |
| 8. AI integration planning | Documented | ai-integration.md |
| 9. Final system blueprint | In progress | This document; update after database, API, and UI/UX work |

This blueprint summarizes the design. Detailed module rules, database source, and AI decisions remain in their respective documents.
