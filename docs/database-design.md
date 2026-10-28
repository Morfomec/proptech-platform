# Database Design

## Overview

The PropTech platform uses **PostgreSQL** as its relational database. The database is shared by the Django modular monolith, with each module responsible for its own data.

- **Primary keys:** UUID
- **Timestamps:** Created and updated timestamps
- **Currency:** INR, with decimal fields for monetary values
- **Relationships:** Foreign keys maintain data relationships between records

## Entity Relationship Diagram

- [View ERD image](diagrams/database-erd.png)
- [Open editable DBML source](diagrams/database-erd.dbml)

## Main Entities

| Area | Tables | Purpose |
|---|---|---|
| Accounts | `users`, `user_profiles` | Users, authentication and profiles |
| Properties | `properties`, `units`, `property_images`, `saved_properties` | Property details, units, images and saved properties |
| Listings | `listings`, `listing_images` | Rental listings and their images |
| Leasing | `applications`, `application_status_history`, `tenancies` | Applications, status history and tenancies |
| Rent | `rent_charges`, `payments`, `payment_allocations` | Rent due, recorded payments and payment allocation |
| Supporting | `notifications`, `audit_logs`, `documents` | Notifications, audit history and document metadata |

The database design contains 17 tables across these areas. The ownership and responsibilities of each module are described in [Module Boundaries](module-boundaries.md).

## Key Relationships

- A user can own multiple properties.
- A property can contain multiple units.
- A unit can have rental listings and tenancy records over time.
- A listing can receive rental applications.
- An approved application can be linked to a tenancy.
- A tenancy can have multiple rent charges and payments.
- Payment allocations link payments to rent charges.

## Data Integrity

The database and Django application will enforce the necessary relationships, uniqueness rules, valid values and financial integrity checks. Transactional service logic will protect workflows such as tenancy creation and payment allocation.

Detailed fields, foreign-key definitions, indexes and implementation-specific constraints are maintained in the [editable DBML schema](diagrams/database-erd.dbml) and will be implemented through Django models and migrations.
