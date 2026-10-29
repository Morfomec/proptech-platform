# Figma UI/UX Design Reference

This document provides the reference link and guidelines for the PropTech platform user interface and experience designs.

---

## 1. Design Source of Truth

The canonical, editable UI/UX designs, wireframes, component styles, and user flow mockups are maintained directly in Figma:

- **Figma Design Project**: [PropTech UI Design on Figma](https://www.figma.com/design/r4INzMqS4Z5hEmoMYkrAie/PropTech?node-id=112-5022&p=f&t=wpXOG0tOdNVMByaQ-0)

> [!NOTE]
> **Source of Truth Policy**:
> Figma serves as the dynamic source of truth for all editable UI designs, typography tokens, color palettes, and interaction layouts.
> To keep the repository lightweight and avoid version desynchronization, large binary exports or entire design dumps (such as full PDF exports) are intentionally kept outside of version control. The repository maintains this reference link as the single pointer to the live designs.

---

## 2. Core User Flows Mapped in Figma

The Figma project captures the complete user journey across key personas (Property Owners, Tenants, and Administrators):

1. **Authentication & Onboarding**:
   - Registration, login, role selection, and user profile management.
2. **Property & Unit Management**:
   - Property creation, unit configuration, amenity tagging, and image management.
3. **Rental Listing Creation & Marketplace**:
   - Listing composition with AI description draft assistance.
   - Public listing search, filtering, and detailed unit view for prospective tenants.
4. **Rental Applications & Approvals**:
   - Tenant application submission workflow.
   - Owner review dashboard for accepting or rejecting applicant submissions.
5. **Tenancy & Rent Tracking**:
   - Tenancy agreement details, agreed rental terms, and active tenancy status.
   - Rent payment tracking, charge schedules, and payment receipts.

---

## 3. Implementation Alignment

When translating Figma designs into frontend components (React + TypeScript):
- Ensure component layouts and form fields align with the domain entities outlined in [Database Design](../database-design.md) and [System Architecture](../system-architecture.md).
- Follow the API contract specifications in [API Documentation](../api/README.md) for data fetching and mutation payloads.
- Refer to [Product Requirements Document (PRD)](../requirements.md) to maintain clear boundaries between MVP UI capabilities and post-MVP features.
