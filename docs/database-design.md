# Database Design: PropTech Platform

## 1. Database Overview
- **Engine**: PostgreSQL relational database managed by a Django 6 modular monolith.
- **Keys**: Every table uses a `uuid` primary key (`gen_random_uuid()`).
- **Timestamps**: UTC `created_at` and `updated_at` (`timestamptz`, default `now()`) on all tables.
- **Financial Types**: Monetary values use `numeric(12,2)` with currency defaulting to `'INR'`.
- **Domain Boundaries**: Tables are partitioned by owning Django app ([module-boundaries.md](module-boundaries.md)).

---

## 2. Entity Relationship Diagram
- **Visual ERD**: [diagrams/database-erd.png](diagrams/database-erd.png)
- **Editable Source**: [diagrams/database-erd.dbml](diagrams/database-erd.dbml)

```
users (1) ──────< user_profiles (1)
users (1) ──────< properties (N) ──────< units (N) ──────< listings (N)
units (1) ──────< tenancies (N) ──────< rent_charges (N) ──────< payment_allocations (N)
tenancies (1) ──< payments (N) ──────< payment_allocations (N)
listings (1) ───< applications (N) ───< application_status_history (N)
applications (1)─< tenancies (1)
```

---

## 3. Table Catalogue (17 Tables)

### Accounts Module
| Table | Purpose | Keys (PK / FK) | Columns & Constraints |
| :--- | :--- | :--- | :--- |
| **`users`** | Core user identity & auth. | PK: `id` | `email` (unique, varchar 254), `password` (128), `first_name`, `last_name`, `is_active`, `is_staff`, `is_superuser`, `last_login`, `email_verified_at`. |
| **`user_profiles`** | Extended user profile details. | PK: `id`<br>FK: `user_id` -> `users.id` (1:1) | `phone_number` (20), `profile_image` (500), `bio` (text). Unique index on `user_id`. |

### Properties Module
| Table | Purpose | Keys (PK / FK) | Columns & Constraints |
| :--- | :--- | :--- | :--- |
| **`properties`** | Physical real estate asset. | PK: `id`<br>FK: `owner_id` -> `users.id` | `name` (200), `property_type` (30), `description`, address lines, `locality`, `city`, `district`, `state`, `pin_code` (char 6), `country_code` (IN), `status` (draft). |
| **`units`** | Individual rentable units. | PK: `id`<br>FK: `property_id` -> `properties.id` | `unit_number` (50), `unit_type` (30), `floor_number`, `bedrooms`, `bathrooms`, `area_sqft`, `furnishing_status`, `monthly_rent`, `security_deposit`, `status`. Unique index `(property_id, unit_number)`. |
| **`property_images`** | Photos of the property. | PK: `id`<br>FK: `property_id` -> `properties.id` | `image_url` (1000), `caption`, `display_order`, `is_primary` (bool). Index `(property_id, display_order)`. |
| **`saved_properties`** | Tenant bookmarks. | PK: `id`<br>FK: `user_id`, `property_id` | Unique index `(user_id, property_id)`; index `(user_id, created_at)`. |

### Listings Module
| Table | Purpose | Keys (PK / FK) | Columns & Constraints |
| :--- | :--- | :--- | :--- |
| **`listings`** | Rental listings for a unit. | PK: `id`<br>FK: `unit_id` -> `units.id`<br>FK: `reviewed_by_id` -> `users.id` | `title` (200), `description`, `monthly_rent`, `security_deposit`, `available_from`, `status` (draft/published), `published_at`, `review_status` (pending/approved), `rejection_reason`. Index `(status, published_at)`. |
| **`listing_images`** | Marketing photos for listing. | PK: `id`<br>FK: `listing_id` -> `listings.id` | `image_url` (500), `caption`, `display_order`, `is_primary`. Index `(listing_id, display_order)`. |

### Leasing Module
| Table | Purpose | Keys (PK / FK) | Columns & Constraints |
| :--- | :--- | :--- | :--- |
| **`applications`** | Tenant rental applications. | PK: `id`<br>FK: `listing_id` -> `listings.id`<br>FK: `applicant_id` -> `users.id`<br>FK: `reviewed_by_id` -> `users.id` | `status` (submitted/approved/rejected), `message`, `reviewed_at`. Unique index `(listing_id, applicant_id)`; indexes `(listing_id, status)` and `(applicant_id, created_at)`. |
| **`application_status_history`** | Status transition history. | PK: `id`<br>FK: `application_id`<br>FK: `changed_by_id` -> `users.id` | `previous_status`, `new_status`, `change_reason`. Index `(application_id, created_at)`. |
| **`tenancies`** | Active lease agreements. | PK: `id`<br>FK: `unit_id` -> `units.id`<br>FK: `tenant_id` -> `users.id`<br>FK: `application_id` (unique) | `start_date`, `end_date`, `monthly_rent`, `security_deposit`, `rent_due_day` (default 1), `status` (pending/active), `actual_move_in_date`, `actual_move_out_date`, `notes`. Indexes on `(unit_id, status)`, `(tenant_id, status)`. |

### Rent Module
| Table | Purpose | Keys (PK / FK) | Columns & Constraints |
| :--- | :--- | :--- | :--- |
| **`rent_charges`** | Periodic rent/fee demands. | PK: `id`<br>FK: `tenancy_id` -> `tenancies.id` | `billing_period_start`, `billing_period_end`, `due_date`, `amount`, `status` (unpaid/paid), `description`. Unique index `(tenancy_id, billing_period_start)`; index `(status, due_date)`. |
| **`payments`** | Manual payment receipts. | PK: `id`<br>FK: `tenancy_id` -> `tenancies.id` | `amount`, `currency` (INR), `payment_method`, `transaction_reference`, `status` (pending/completed), `paid_at`, `notes`. Indexes `(tenancy_id, created_at)`, `(status, created_at)`, `transaction_reference`. |
| **`payment_allocations`** | Payment-to-charge splits. | PK: `id`<br>FK: `payment_id` -> `payments.id`<br>FK: `rent_charge_id` -> `rent_charges.id` | `allocated_amount`. Unique index `(payment_id, rent_charge_id)`; index `rent_charge_id`. |

### Cross-Cutting Modules
| Table | Purpose | Keys (PK / FK) | Columns & Constraints |
| :--- | :--- | :--- | :--- |
| **`notifications`** | User alerts & notices. | PK: `id`<br>FK: `user_id` -> `users.id` | `notification_type`, `title`, `message`, `related_object_type`, `related_object_id`, `is_read`, `read_at`. Indexes `(user_id, is_read, created_at)`, `(user_id, created_at)`. |
| **`audit_logs`** | Security audit trail. | PK: `id`<br>FK: `actor_id` -> `users.id` | `action`, `entity_type`, `entity_id`, `old_values` (jsonb), `new_values` (jsonb), `ip_address`, `user_agent`. Indexes `(entity_type, entity_id, created_at)`, `(actor_id, created_at)`, `(action, created_at)`. |
| **`documents`** | Attachment metadata. | PK: `id`<br>FK: `uploaded_by_id` -> `users.id` | `document_type`, `file_url`, `original_filename`, `mime_type`, `file_size_bytes`, `related_object_type`, `related_object_id`, `status`. Indexes `(uploaded_by_id, created_at)`, `(related_object_type, related_object_id)`. |

---

## 4. Relationship and Ownership Rules
- **Strict Table Ownership**: Each module owns its tables. Direct cross-module table mutations are prohibited.
- **Service Interfaces**: Multi-entity actions (e.g., application approval -> tenancy creation) execute through service functions inside `transaction.atomic()`.
- **Polymorphic Decoupling**: `notifications`, `audit_logs`, and `documents` use `(related_object_type, related_object_id)` to reference domain entities without foreign key coupling.

---

## 5. Constraints and Data Integrity

| Integrity Rule | Current Tier | Enforcement Mechanism & Details |
| :--- | :---: | :--- |
| **Unique unit number per property** | **Schema Enforced** | `UNIQUE (property_id, unit_number)` on `units`. |
| **Unique saved property per user** | **Schema Enforced** | `UNIQUE (user_id, property_id)` on `saved_properties`. |
| **Unique application per applicant & listing** | **Schema Enforced** | `UNIQUE (listing_id, applicant_id)` on `applications`. |
| **Single primary image per property/listing** | **Intended DB Migration** | Partial unique index: `CREATE UNIQUE INDEX ON ... (parent_id) WHERE (is_primary = true);`. |
| **Single active listing per unit** | **Intended DB Migration** | Partial unique index: `CREATE UNIQUE INDEX ON listings (unit_id) WHERE (status = 'published');`. |
| **Valid tenancy dates & amounts** | **Intended DB Migration** | Checks: `end_date IS NULL OR end_date >= start_date`, `monthly_rent >= 0`, `rent_due_day BETWEEN 1 AND 28`. |
| **Overlapping tenancy prevention** | **Service / DB Constraint** | *PostgreSQL*: `EXCLUDE USING gist (unit_id WITH =, daterange(...) WITH &&)`. *MVP*: `select_for_update()` lock on `units`. |
| **Valid rent charge periods & amounts** | **Intended DB Migration** | Checks: `billing_period_end >= billing_period_start`, `amount > 0`. |
| **Allocation limit protection** | **Service Layer** | Verified via `select_for_update()` in `transaction.atomic()`: `SUM(allocated) <= payment.amount` & `charge.amount`. |
| **Cross-tenancy allocation isolation** | **Unresolved / Intended** | Proposed composite foreign key: `(payment_id, tenancy_id)` and `(rent_charge_id, tenancy_id)` on `payment_allocations`. |
| **Payment reference uniqueness** | **Intended DB Migration** | Partial unique index: `CREATE UNIQUE INDEX ON payments (transaction_reference) WHERE (transaction_reference IS NOT NULL AND transaction_reference != '');`. |

---

## 6. Financial Data Integrity
- **Model**: `tenancies` own `rent_charges` (liabilities) and `payments` (manual receipts). `payment_allocations` links payments to charges.
- **Outstanding Balance**: $\text{Balance} = \sum(\text{rent\_charges.amount}) - \sum(\text{payment\_allocations.allocated\_amount})$.
- **Allocation Rules**: Executed in `transaction.atomic()`. Allocations cannot exceed the payment amount or unpaid charge amount. Only completed payments are eligible.

---

## 7. Status Vocabularies

| Table | Status Column | Allowed Values |
| :--- | :--- | :--- |
| **`properties`** | `status` | `'draft'`, `'active'`, `'archived'` |
| **`units`** | `status` | `'active'`, `'occupied'`, `'maintenance'`, `'inactive'` |
| **`listings`** | `status`<br>`review_status` | `status`: `'draft'`, `'published'`, `'unpublished'`<br>`review_status`: `'pending'`, `'approved'`, `'rejected'` |
| **`applications`** | `status` | `'submitted'`, `'under_review'`, `'approved'`, `'rejected'`, `'withdrawn'` |
| **`tenancies`** | `status` | `'pending'`, `'active'`, `'terminated'`, `'expired'` |
| **`rent_charges`**| `status` | `'unpaid'`, `'partially_paid'`, `'paid'`, `'cancelled'` |
| **`payments`** | `status` | `'pending'`, `'completed'`, `'failed'`, `'refunded'` |
| **`documents`** | `status` | `'active'`, `'archived'`, `'deleted'` |

---

## 8. Django Implementation Considerations
1. **Custom User Model**: Inherit `AbstractBaseUser` + `PermissionsMixin`; add `last_login timestamptz`. Map roles via Django `Group`.
2. **Metadata Constraints**: Define partial unique indexes and check constraints inside model `Meta.constraints`.
3. **Concurrency & Transactions**: Use `transaction.atomic()` and `select_for_update()` for tenancies, status updates, and allocations.
4. **Field Definitions**: Use `models.UUIDField` for PKs and `models.DecimalField(max_digits=12, decimal_places=2)` for currency.

---

## 9. Open Decisions and Validation Checklist
- [x] **Commit DBML**: Raw `database-erd.dbml` committed to `docs/diagrams/database-erd.dbml`.
- [x] **User Model**: Included `last_login` in `users` model definition.
- [ ] **Composite Key Decision**: Enforce composite FKs on `payment_allocations` at DB level vs. service layer.
- [ ] **Partial Indexes**: Add migrations for primary images, single published listing, and payment reference.
- [ ] **Tenancy Overlap**: Select `btree_gist` exclusion constraint vs. service-level row locking.
- [ ] **Charge Types**: Add `charge_type` to `rent_charges` to allow multi-item billing per period.

---

## 10. Documentation Links
- **Requirements**: [requirements.md](requirements.md)
- **Module Boundaries**: [module-boundaries.md](module-boundaries.md)
- **System Architecture**: [system-architecture.md](system-architecture.md)
- **Database ERD Image**: [diagrams/database-erd.png](diagrams/database-erd.png)
- **Final System Blueprint**: [final-system-blueprint.md](final-system-blueprint.md)
