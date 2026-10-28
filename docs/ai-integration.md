# AI Integration Planning

## 1. MVP Feature

The platform uses AI only to generate draft descriptions for rental listings. An owner supplies property and unit details, requests a draft, then reviews and edits it before saving or publishing the listing.

The AI does not approve, save, or publish listings.

### Out of Scope

- Tenant-property matching or recommendation engines
- AI chatbots or conversational support
- Searching tenancy documents or laws with RAG
- Rent-price prediction
- Property-photo analysis
- Fine-tuned models, vector databases, or autonomous agents

## 2. Architecture

The AI capability is a stateless module within the Django modular monolith.

**Request flow:** Owner → React form → Django REST API → ai_assistant service → external AI provider → validated draft returned to the owner. The owner submits the final text through the normal listings workflow.

### Responsibilities

- **Frontend:** Collects details, shows the draft in an editable field, and allows manual entry if AI generation fails.
- **Django API:** Authenticates the user, checks permission to create or edit the listing, and validates the request.
- **ai_assistant:** Builds prompts, calls the provider, applies timeouts, validates output, and handles provider errors.
- **External provider:** Generates draft text from the supplied facts.
- **listings:** Owns listing records and all save, review, and publication operations.

The AI module owns no database tables and should be called through an internal Python service interface.

## 3. Input and Prompt Rules

Inputs may include property type, locality and city, bedrooms and bathrooms, floor, area, furnishing status, rent, deposit, amenities, and optional owner notes.

Prompts should:
- Use only the supplied facts and avoid inventing amenities, nearby landmarks, travel times, or legal claims.
- Avoid discriminatory or exclusionary language.
- Avoid guarantees about rental outcomes or availability.
- Return clear, professional text suitable for an editable rental listing.
- Treat owner-supplied notes as untrusted input and avoid including personal or confidential information.

The owner remains responsible for checking accuracy before publication.

## 4. Validation and Error Handling

The API should reject invalid or incomplete input before calling the provider. The AI service should validate the provider response, reject empty or malformed output, and enforce a maximum output length.

Proposed safeguards:
- Provider request timeout: 8 seconds.
- Maximum generated text: 2,000 characters.
- Suggested usage limit: 10 generation requests per owner per hour.

These are design targets, not claims that the limits are already implemented. They should be configured and tested during development.

If the provider times out, returns a rate-limit response, or fails, the API should return a clear error and let the owner continue by writing the description manually. Raw provider errors and secrets must not be exposed to the browser.

## 5. Security, Privacy, and Cost

- Keep provider API keys in server-side environment variables or a secrets manager.
- Never include provider credentials in the React application or source control.
- Send only the property information needed for description generation.
- Do not send user credentials, tenant identities, contact details, or payment information.
- Apply request-size and usage limits to reduce abuse and unexpected provider costs.
- Treat generated text as untrusted input and sanitize it before rendering.
- Do not claim that a provider retains no data or never trains on requests unless the selected provider's applicable terms support that claim.

## 6. Technology Decisions

- Use a provider adapter inside ai_assistant so provider-specific HTTP and response handling do not spread across the application.
- Keep provider credentials and model settings configurable through server-side environment variables.
- Keep the MVP request/response based; a message broker or background worker is not required for this feature.
- If AI generation is unavailable, listing creation must continue to work without AI.

## 7. Relationship to the Rest of the System

The design follows the [System Architecture](system-architecture.md) and [Module Boundaries](module-boundaries.md). The AI service returns draft text; the listings module remains responsible for persisting and publishing the final listing.

Detailed REST endpoints and request/response schemas will be specified in the separate API design.
