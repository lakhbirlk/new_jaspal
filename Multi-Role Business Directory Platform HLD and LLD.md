# Multi-Role Business Directory Platform: High-Level and Low-Level Design

Version 1.1 | Spring Boot monolith, one database, React Native app, credit-based subscriptions | Covers authentication, authorization, field-level visibility, and the admin control panel

## 1. Purpose and Scope

The platform hosts a database of businesses. Four types of users interact with it:

| Role | Who they are | Core ability |
| --- | --- | --- |
| Researcher | Research member | Search and research business data (limited preview fields until they subscribe and spend a credit to unlock a business) |
| Business | A listed business | Register, manage and view only their own business profile and documents, and buy a listing plan to be visible to researchers |
| Auditor | Compliance reviewer | Read-only review of business details, with a full trail of what they viewed |
| Admin | Super user | See and edit all users and businesses, approve or reject documents, and control what every role can see |

Goals:

1. Secure registration, login and session handling for all roles.
2. Role-based authorization, plus field-level control over what each role (and optionally each individual user) can see.
3. An admin control panel to manage users, documents, and visibility rules without code changes.
4. Full audit trail of sensitive actions.

## 2. High-Level Design (HLD)

### 2.1 Architecture Overview

The backend is one Spring Boot application shipped as a single executable JAR. Its only dependency is one PostgreSQL database. There is no Redis, message broker, object store or search server. Every client is the React Native app.

```
+---------------------------------------------------+
|        React Native app (iOS, Android, Web)       |
|  Researcher | Business | Auditor | Admin screens    |
+-------------------------+-------------------------+
                          | HTTPS, REST + JSON
         +----------------v-----------------+
         |    Spring Boot monolith (1 JAR)  |
         |  Security filter chain (JWT)     |
         |  Controllers > Services > Repos  |
         |  Auth | Users | Business | Search|
         |  Documents | Policy | Audit      |
         |  Admin | @Scheduled jobs         |
         |  In-JVM: policy map, rate limits |
         +----------------+-----------------+
                          | JDBC (HikariCP)
                 +--------v---------+
                 |   PostgreSQL     |
                 | all data, files, |
                 | policies, audit, |
                 | tokens, search   |
                 +------------------+
```

### 2.2 Major Modules

Each module is a Java package inside the one application (package by feature). Modules call each other as plain method calls, never over a network.

| Module | Responsibility |
| --- | --- |
| Auth Service | Register, login, email verification, password reset, MFA, token issue and refresh |
| User and Role Service | User accounts, roles, profile data, status (pending, active, suspended) |
| Business Service | Business records, ownership, business self-service edits |
| Search Service | Researcher search over business data, filtered by the policy engine |
| Document Service | Upload, store, and review KYC and business documents |
| Policy Engine | Central decision point: can this user do this action, and which fields may they see or edit |
| Audit Service | Immutable log of logins, views, edits, approvals, policy changes |
| Admin Control Panel | UI over all of the above, including the visibility matrix |
| Subscription and Credit Service | Plans, researcher subscriptions, credit ledger, business unlocks, expiry job |

### 2.3 Role Lifecycle

| Role | How the account is created | Activation |
| --- | --- | --- |
| Researcher | Quick self-registration with basic details, full profile and documents added afterwards | Email verified, profile completed and submitted, then admin approves |
| Business | Quick self-registration with basic details and a draft business, full profile and documents added afterwards | Email verified, profile completed and submitted, then admin approves |
| Auditor | Invitation by admin only (no public signup) | Accepts invite, sets password, MFA mandatory |
| Admin | Seeded at install, or created by another admin | MFA mandatory |

### 2.4 Authentication and Authorization Strategy (summary)

- Authentication: email and password (argon2id), email verification, short-lived JWT access tokens and rotating refresh tokens, TOTP-based MFA (mandatory for Admin and Auditor, optional for others).
- Authorization has three layers, evaluated in order:
  1. Role permission (RBAC): can this role perform this action on this resource type at all?
  2. Scope (ownership): a Business user may only touch their own business. Researchers get read scope over currently listed businesses only, Auditors over all businesses.
  3. Field policy: for every resource, each field is hidden, masked, read-only, or editable for a given role, with optional per-user overrides set from the control panel.

### 2.5 Technology Stack

| Layer | Choice |
| --- | --- |
| Client (all roles, including admin panel) | React Native with TypeScript, React Navigation, react-native-web if a desktop browser build is wanted |
| Backend | Java 21, Spring Boot 3, Spring Web, Spring Security, Spring Data JPA (Hibernate), Bean Validation |
| Database | PostgreSQL only: business data, documents, audit, tokens, policies |
| Schema migrations | Flyway, run by the application at startup |
| Authentication | Spring Security with JWT access tokens, Argon2id password hashing, a TOTP library for MFA |
| Search | PostgreSQL full-text search (tsvector with a GIN index) |
| File storage | Document bytes in PostgreSQL (bytea), served through authenticated endpoints |
| Caching, rate limiting, jobs | In-memory inside the JVM and Spring @Scheduled |
| Email | Spring Mail over SMTP, the single optional outbound integration (see Section 5) |
| Build and deploy | Maven or Gradle, one executable JAR |

### 2.6 Non-Functional Requirements

- All traffic over TLS, configured directly in Spring Boot. Passwords hashed with Argon2id. Sensitive columns and document bytes encrypted by the application (AES-GCM, key from an environment variable) before they reach the database.
- Rate limiting on login, register and search, held in memory. Lockout counters live in the users table so they survive restarts.
- Every sensitive read and write is audit-logged to the database.
- Policy changes apply immediately: the in-memory policy map is reloaded from the database on every change from the control panel.
- One deployable instance, scaled vertically. Running several instances would need the in-memory pieces moved into the database (Section 5).

### 2.7 Researcher Subscription and Credit Model

A researcher sees only a limited preview of every business until they subscribe. A subscription carries credits, and one credit unlocks one business until that subscription ends.

| Rule | Behaviour |
| --- | --- |
| No subscription | The researcher sees preview fields only (Section 3.2) and cannot unlock anything |
| Subscribe | After admin approval, the researcher picks a plan. The plan grants its credits and runs for its duration |
| Unlock | Spends 1 credit and reveals the full unlocked field set of that one business |
| Viewing again | Free. An unlocked business stays open for the rest of the subscription, no extra credit |
| Unused credits | Expire with the subscription. No carry forward |
| Subscription ends | Every business unlocked under it locks again at that moment. Seeing it again needs a new subscription and a new credit |
| New plans | Plans are database rows (credits, duration, price), so an admin adds one from the control panel with no code change |
| Admin control | Admin can grant or remove credits, extend or cancel a subscription, each with a reason in the audit log |

Launch plan:

| Plan | Credits | Duration | Carry forward |
| --- | --- | --- | --- |
| Basic | 5 | 1 month | No |
| Future plans | Set by admin | Set by admin | No |

### 2.8 Business Listing Plans

A business is listed in the directory only while an admin has listed it and it holds a paid listing plan. When the plan ends the business is unlisted, not deleted.

| Rule | Behaviour |
| --- | --- |
| Registration | Basic details first, then the full profile and documents are added and submitted. An admin reviews and approves them |
| Starting state | An approved business starts unlisted. Researchers cannot see it yet |
| Admin listing switch | From the control panel an admin lists or unlists any approved business at any time |
| Plans | 1 month, 1 year or 3 years. Each plan has its own charge, set by the admin |
| Visible to researchers | Only when both hold: an admin has listed it and a paid plan is running. Researchers can then search it and unlock it with a credit |
| Renewing early | The new period starts after the current end date, so paid time is never lost |
| Expiry | At the end instant the business becomes unlisted. Its profile, documents, history and the admin's switch setting all stay in the database |
| While unlisted | Hidden from researcher search, detail and unlock, even for researchers who unlocked it earlier. The owner, auditors and admins still see it |
| Listing again | Buying a plan makes it visible again, provided the admin switch is still on listed. Existing researcher unlocks work again for as long as the researcher's own subscription lasts |
| Admin control | Admin can list or unlist, extend or cancel the paid period, and record an offline payment, each logged in the audit trail |

| Listing plan | Duration | Charge |
| --- | --- | --- |
| Listing 1 month | 1 month | Set by admin |
| Listing 1 year | 12 months | Set by admin |
| Listing 3 years | 36 months | Set by admin |

### 2.9 Registration and Profile Completion

Signup asks only for the basics so people finish it. Everything else is collected afterwards, saved as a draft, and checked only when the user submits for review.

| Stage | What the user does | What they can do meanwhile |
| --- | --- | --- |
| 1. Register | Enters name, email, password and role. A business also enters its business name | Nothing until the email is verified |
| 2. Verify email | Opens the emailed link | Log in with a restricted session |
| 3. Complete profile | Fills in the remaining details and uploads documents, in any order and over several sittings | Edit the profile, upload documents, view plans. No researcher search, no business listing |
| 4. Submit for review | Taps submit once every required field and document is present | Wait. Editing is paused while under review |
| 5. Admin decision | Admin approves or rejects with a reason | Approved: full role access. An approved business starts unlisted until an admin lists it. Rejected: back to stage 3 with the reason shown, then resubmit |

| Role | Asked at registration | Completed later |
| --- | --- | --- |
| Researcher | Full name, email, password | Organization, designation, phone, purpose of research, ID proof document |
| Business | Full name, email, password, business name | Registration number, tax ID, address, industry, category, website, contacts, description, revenue, employee count, bank details, business documents |

Which later fields and documents are mandatory for submission is configured per role by the admin in Settings. Optional fields can be filled any time, before or after approval.

### 2.10 Guest Home and Role-Based Entry

A visitor who is not logged in lands on the home page and is asked one question: are you a business, or a research member and investor? The answer sends them into the matching flow. Guests see no business records.

| Step | Business flow | Research member / investor flow |
| --- | --- | --- |
| 1. Home | Taps the business card | Taps the research member / investor card |
| 2. Landing page | Explains listing, shows the listing plans (1 month, 1 year, 3 years) and their charges | Explains search, credits and unlocking, shows the Basic plan |
| 3. Register | Basic details plus business name | Basic details |
| 4. Verify and complete | Email link, then the profile checklist and documents | Email link, then the profile checklist and documents |
| 5. Admin approval | Approved, starts unlisted until an admin lists it (Section 2.8) | Approved, can subscribe to a plan (Section 2.7) |
| 6. Portal | Business portal: own profile, documents, listing plan | Researcher portal: search, credits, unlocked businesses |

Returning users use the Log in link on the home page. Login looks at the account, not at the card the visitor tapped, so everyone lands in their own portal (researcher, business, auditor or admin). Auditors and admins have no card because they are invited, not self-registered.

## 3. Low-Level Design (LLD)

### 3.1 Data Model

**users**

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK |  |
| email | citext unique |  |
| password\_hash | text | argon2id |
| role | enum(admin, auditor, researcher, business) | single role per user keeps it simple; move to a join table if multi-role is needed |
| status | enum(pending\_email, pending\_profile, pending\_review, active, rejected, suspended) |  |
| email\_verified\_at | timestamptz |  |
| mfa\_secret | text (encrypted) | null if MFA not enabled |
| mfa\_enabled | bool | forced true for admin, auditor |
| failed\_login\_count | int | for lockout |
| locked\_until | timestamptz |  |
| created\_at, updated\_at | timestamptz |  |
| full\_name | text | collected at registration |
| submitted\_at | timestamptz | when the user last submitted the profile for review |
| review\_note | text | admin's rejection reason, shown to the user |

**researcher\_profiles**: user\_id PK/FK, full\_name, organization, designation, phone, purpose\_of\_research.

**businesses**

| Column | Type |
| --- | --- |
| id | uuid PK |
| owner\_user\_id | uuid FK users (nullable until claimed) |
| legal\_name, trade\_name | text |
| registration\_number, tax\_id | text (sensitive) |
| industry, category | text |
| address\_line, city, state, country, postal\_code | text |
| website, public\_email, public\_phone | text |
| contact\_person\_name, contact\_person\_phone | text (sensitive) |
| annual\_revenue, employee\_count | numeric (sensitive) |
| bank\_details | encrypted text (highly sensitive) |
| description | text |
| verification\_status | enum(unverified, verified, rejected) |
| created\_at, updated\_at | timestamptz |
| listed\_until | timestamptz, null if never listed. The business is listed only while this is in the future |
| admin\_listing\_status | enum(unlisted, listed), default unlisted. Set by an admin after approving the business |

**documents**

| Column | Type |
| --- | --- |
| id | uuid PK |
| owner\_user\_id | uuid FK |
| business\_id | uuid FK, nullable (null for researcher docs) |
| doc\_type | enum(id\_proof, business\_license, tax\_certificate, address\_proof, other) |
| content | bytea, lazy-loaded so listings never read file bytes |
| mime\_type, size\_bytes, checksum |  |
| status | enum(pending, approved, rejected) |
| reviewed\_by | uuid FK users |
| reviewed\_at | timestamptz |
| rejection\_reason | text |

**permissions** and **role\_permissions** (RBAC)

- permissions(id, code) with codes such as `business:read`, `business:update`, `business:search`, `user:read`, `user:update`, `document:review`, `policy:manage`, `audit:read`, business:unlock, subscription:manage, plan:manage.
- role\_permissions(role, permission\_id).

**field\_policies** (the visibility matrix)

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK |  |
| role | enum | which role the rule applies to |
| resource | text | `business`, `user`, `document`, and so on |
| field | text | e.g. `tax_id` |
| access | enum(hidden, masked, read, write) | ordered from least to most access |
| updated\_by, updated\_at |  |  |
| unlock\_state | enum(any, locked, unlocked) | researcher rules use locked or unlocked, all other roles use any |

Unique on (role, resource, field, unlock\_state).

**user\_policy\_overrides**: same shape as field\_policies but keyed by user\_id. An override replaces the role-level rule for that one user. Optional `expires_at` supports temporary access.

**audit\_logs** (append only): id, actor\_user\_id, action, resource\_type, resource\_id, before (jsonb), after (jsonb), ip, user\_agent, created\_at.

**refresh\_tokens**: id, user\_id, token\_hash, family\_id, expires\_at, revoked\_at, ip, user\_agent.

**email\_tokens**: id, user\_id, purpose(verify, reset, invite), token\_hash, expires\_at, used\_at.

**research\_access\_log**: researcher user\_id, business\_id, query, viewed\_at (feeds analytics and abuse detection).

Recommended indexes: users(email), businesses(owner\_user\_id), businesses full-text on name/industry/city, documents(status), audit\_logs(actor\_user\_id, created\_at), field\_policies(role, resource).

### 3.2 Default Field Visibility Matrix

This is the seed data. Admin can change every cell from the control panel. Legend: H = hidden, M = masked, R = read, W = write.

| Business field | Researcher (locked) | Researcher (unlocked) | Business (own record) | Auditor | Admin |
| --- | --- | --- | --- | --- | --- |
| legal\_name, trade\_name | R | R | W | R | W |
| industry, category | R | R | W | R | W |
| city, country, description | R | R | W | R | W |
| address\_line, postal\_code | H | R | W | R | W |
| website, public\_email, public\_phone | H | R | W | R | W |
| registration\_number | M | R | R | R | W |
| tax\_id | H | R | R | R | W |
| contact\_person\_name / phone | H | R | W | R | W |
| annual\_revenue, employee\_count | M | R | W | R | W |
| bank\_details | H | H | W | M | W |
| verification\_status | R | R | R | R | W |
| documents | H | H | W (own) | R | W + approve/reject |

Masking examples: registration number shown as `****1234`, revenue shown as a range such as `1M to 5M`.

The two researcher columns apply per business. Researchers can only see businesses that are currently listed (Section 3.14). A listed business is locked for a researcher by default and becomes unlocked only while that researcher holds a valid unlock for it (Section 3.13). Locked is the limited preview. Unlocked shows every detail of that business except bank\_details, which stays hidden by default. Admin can change any cell, including making bank\_details readable once unlocked.

### 3.3 Authentication Flows

**Register (Researcher or Business)**

1. Client submits only full name, email, password and role (a business also sends its business name). Roles admin and auditor are rejected at this endpoint.
2. Server validates input and password strength, creates the user with status `pending_email` (and, for a business, a draft business row holding just the name), and sends a verification email.
3. User clicks the link, status becomes `pending_profile`. The user can now log in with a restricted session.
4. User completes the full profile and uploads documents whenever they like. Partial saves are allowed, and a progress checklist shows what is missing.
5. When every required field and document is present, the user submits for review and status becomes `pending_review`.
6. On approval, status becomes `active` and the full portal opens. On rejection, status returns to `pending_profile` with the admin's reason, and the user fixes the points and resubmits.

**Login**

1. POST credentials. Check lockout, verify argon2id hash, count failures.
2. If status is not `active`, issue a restricted session limited to profile, document and status endpoints, and tell the user what is pending.
3. If MFA is enabled, return an `mfa_required` challenge, then verify the TOTP code.
4. Issue access token (JWT, 15 minutes, contains user id, role, token version) and refresh token (opaque, 7 days, stored hashed, rotated on every use, kept by the app in device secure storage (iOS Keychain, Android Keystore)).
5. Reuse of an already-rotated refresh token revokes the whole token family (theft detection).

**Other flows**: forgot and reset password (single-use, 30 minute token), change password (revokes all refresh tokens), logout (revoke refresh token), auditor invite (admin creates invite, user sets password and enrolls MFA on first login).

### 3.4 Authorization Pipeline

Every request passes through the same pipeline:

```
Request
  -> authenticate (verify JWT, load user, check status; non-active users reach only profile, document and status endpoints)
  -> permission check (role has permission code?)
  -> scope check (business user: own business only; researcher: listed businesses only)
  -> load handler
  -> response/request field filter (Policy Engine)
  -> audit log (for sensitive actions)
```

**Policy Engine algorithm**

```
function unlockState(user, resource, record):
    if user.role != RESEARCHER or resource != business: return ANY
    // one batched lookup per result page, never one query per row
    return hasActiveUnlock(user.id, record.id, now) ? UNLOCKED : LOCKED
    // active = a business_unlocks row whose subscription is active and ends_at > now

function effectiveAccess(user, resource, field, state):
    override = userOverrides.find(user.id, resource, field, state, notExpired)
    if override: return override.access
    rule = fieldPolicies.find(user.role, resource, field, state)
    return rule ? rule.access : HIDDEN        // default deny

function filterOutput(user, resource, record):
    state = unlockState(user, resource, record)
    out = {}
    for field in record:
        a = effectiveAccess(user, resource, field, state)
        if a == HIDDEN: skip
        if a == MASKED: out[field] = maskFn(field, record[field])
        else: out[field] = record[field]
    out.unlocked = (state == UNLOCKED)
    return out

function filterInput(user, resource, payload):
    for field in payload:
        if effectiveAccess(user, resource, field, ANY) != WRITE: reject 403 with field name
```

Important rules:

- Default deny: a field with no rule is hidden.
- Filtering is enforced on the server in a shared serializer layer, never in the UI only.
- Search results and exports use the same filter. Researchers cannot search by a hidden field (otherwise values can be inferred), so the search service whitelists searchable fields per role.
- Policies are loaded from the database into an in-memory map keyed by (role, resource) and reloaded on every change from the control panel.

### 3.5 REST API

Base path `/api/v1`. All responses pass through the field filter.

**Auth**

| Method | Path | Purpose |
| --- | --- | --- |
| POST | /auth/register | Signup with basic details only |
| POST | /auth/verify-email | Confirm email token |
| POST | /auth/login | Credentials, returns tokens or mfa\_required |
| POST | /auth/mfa/verify | Complete MFA challenge |
| POST | /auth/refresh | Rotate refresh token |
| POST | /auth/logout | Revoke session |
| POST | /auth/forgot-password, /auth/reset-password | Reset flow |
| POST | /auth/accept-invite | Auditor or admin invite |
| GET | /me | Current user, role and effective field permissions |

**Profile completion (researcher and business)**

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /me/profile/completion | Percent complete, missing fields, missing documents |
| GET, PATCH | /me/profile | Researcher profile, partial saves allowed (a business edits through /my/business) |
| POST | /me/submit-for-review | Submit once complete, status becomes pending\_review. Returns 422 with the missing items if incomplete |

**Public (no login)**

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /public/plans?audience= | Active plans for the landing pages. The audience is business or researcher. It also replaces GET /plans and GET /listing-plans, so the in-app plan screens read the same data |

**Researcher**

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /businesses?q=&industry=&city=&page= | Search. Locked businesses return preview fields only, each with an unlocked flag |
| GET | /businesses/{id} | Business detail: preview fields if locked, full set if unlocked |
| POST | /businesses/{id}/unlock | Spend 1 credit to unlock. Repeating it on an unlocked business costs nothing |
| GET | /businesses/unlocked | Businesses unlocked right now (empty after the subscription ends) |
| GET | /plans | Active plans available |
| POST | /subscriptions | Subscribe to a plan by code |
| GET | /subscriptions/me | Current plan, credits remaining, end date |
| GET | /credits/ledger | Credit history |
| POST | /saved-searches | Save a query |

**Business**

| Method | Path | Purpose |
| --- | --- | --- |
| GET, PATCH | /my/business | View and update own business (writable fields only) |
| POST | /my/documents | Upload a document |
| GET | /my/documents | List own documents and review status |
| GET | /listing-plans | Active listing plans with their charges |
| POST | /my/listing | Buy or renew a listing by plan code, returns the payment to complete |
| GET | /my/listing | Listed or unlisted, listed\_until, listing history |
| GET | /my/payments | Own payments |
| POST | /payments/webhook/{provider} | Payment provider callback, signature-checked, only if a gateway is used |

**Auditor**

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /audit/businesses, /audit/businesses/{id} | Read-only business review |
| GET | /audit/businesses/{id}/documents | View documents |
| POST | /audit/businesses/{id}/notes | Optional review notes |

**Admin**

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /admin/users, /admin/users/{id} | List and view users |
| PATCH | /admin/users/{id} | Edit details, role, status, suspend or activate |
| POST | /admin/users/invite | Invite auditor or admin |
| GET, PATCH | /admin/businesses, /admin/businesses/{id} | Manage business data |
| GET | /admin/documents?status=pending | Review queue |
| POST | /admin/documents/{id}/approve | Approve |
| POST | /admin/documents/{id}/reject | Reject with reason |
| GET, PUT | /admin/policies/fields | Read and update the visibility matrix, including the locked and unlocked states |
| GET, PUT, DELETE | /admin/policies/users/{userId} | Per-user overrides |
| GET | /admin/policies/preview?role=&userId=&businessId=&state= | See exactly what that user would see, locked or unlocked |
| GET, POST, PATCH | /admin/plans, /admin/plans/{id} | List, create and edit researcher and business plans, set charges, activate or retire |
| GET | /admin/subscriptions?userId= | Subscriptions and credit ledger of a researcher |
| POST | /admin/subscriptions/{id}/credits | Grant or remove credits (reason required) |
| POST | /admin/subscriptions/{id}/extend, /admin/subscriptions/{id}/cancel | Extend or cancel a researcher subscription |
| GET | /admin/listings?status= | Businesses with their listing\_status and expiry date. The status filter takes not\_approved, unlisted\_by\_admin, awaiting\_plan, expired, listed or expiring |
| POST | /admin/businesses/{id}/listing/list, /admin/businesses/{id}/listing/unlist | Admin listing switch for an approved business |
| POST | /admin/businesses/{id}/listing/extend, /admin/businesses/{id}/listing/cancel | Extend or cancel the paid period |
| GET, POST | /admin/payments | List payments, record an offline payment (marks it paid) |
| GET | /admin/audit-logs | Search audit trail |

### 3.6 Document Approval Workflow

```
uploaded (pending) --> admin opens review queue
    |-- approve --> status approved, user notified; if all required docs approved,
    |                the user moves from pending_review to active
    |-- reject  --> status rejected + reason, user notified, can re-upload
```

- Files are stored in the documents table (bytea) of the same PostgreSQL database and streamed through an authenticated endpoint after a permission check. No public file URLs exist.
- Validate file type and size (for example 10 MB through Spring multipart limits) and store a checksum.
- Every approve or reject writes an audit log entry with reviewer, time and reason.

### 3.7 Admin Control Panel Design

The control panel is a set of admin-only screens inside the same React Native app, backed only by the /admin APIs. On a phone, the field visibility grid becomes a per-role view with one dropdown per field. A desktop browser build through react-native-web shows the full grid.

**Navigation**

1. Dashboard: counts of pending users, pending documents, active users per role, active subscriptions, listed and unlisted businesses, listings expiring in 30 days, credits spent this month, recent audit events.
2. Users: table with filters (role, status), detail page to edit profile, change status, force password reset, reset MFA, suspend.
3. Businesses: table and detail page with edit, verification status, ownership assignment, and a List and Unlist switch for each business.
4. Document Review: queue with preview pane, approve and reject (reason required).
5. Access Control, with three tabs:
   - **Role permissions**: matrix of roles against permission codes (checkboxes).
   - **Field visibility**: pick a resource (for example Business), see a grid of fields as rows and roles as columns, each cell a dropdown (Hidden, Masked, Read, Write). For the Researcher a Locked and Unlocked switch shows one column of dropdowns per state. Save applies immediately and logs the change.
   - **User overrides**: search a user, add field-level overrides, optional expiry date.
6. Plans and Subscriptions: list, create and edit researcher and business plans (name, audience, credits, duration, charge, active). Open a business to see its listing history, payments and expiry, then extend, cancel or block its listing or record an offline payment. Open a researcher to see their subscription, credit ledger and unlocked businesses, grant or remove credits, extend or cancel.
7. Preview as role/user: a read-only simulation showing the exact screen and fields that user will get, with a locked or unlocked toggle for researchers. Essential for verifying a policy change before and after saving.
8. Audit Log: filter by actor, action, resource and date, with before and after diff and CSV export.
9. Settings: password policy, session length, MFA enforcement, required profile fields and documents per role.

**Safety rules for the panel**

- Admin-only, MFA required, short idle timeout.
- Admins cannot lower their own access or remove the last active admin.
- Policy edits require confirmation and show a diff of what changes.
- All changes are versioned in audit\_logs so a prior matrix can be restored.

### 3.8 React Native App Structure

```
/src
  /navigation   RootNavigator: guest stack, onboarding stack, then one navigator per role
  /screens
    /guest       Home (role choice), BusinessLanding, ResearcherLanding
    /auth        Login, Register (basic details), VerifyEmail, ResetPassword, Mfa,
                 Onboarding (ProfileChecklist, ProfileForm, DocumentUpload, ReviewStatus)
    /researcher  Search, BusinessDetail (locked or unlocked), UnlockedList, Plans,
                 MySubscription, CreditHistory, SavedSearches
    /business    MyBusiness, Documents, StatusBanner, ListingPlans, MyListing, Payments
    /auditor     BusinessList, BusinessDetail, Notes
    /admin       Dashboard, Users, Businesses, DocumentReview, PlansAdmin, Subscriptions,
                 Listings, Payments, AccessControl (RoleMatrix, FieldVisibility, UserOverrides),
                 PreviewAs, AuditLog, Settings
  /components   Field, MaskedText, DataTable, StatusChip
  /services     apiClient (refresh-token interceptor), authStore
  /hooks        useAuth, useCan(permission), useFieldAccess(resource, field)
  /storage      secureStorage (Keychain / Keystore wrapper)
```

The UI asks `/me` for effective field permissions and renders only allowed fields. A `<Field>` component hides, masks or locks inputs accordingly. This is for usability only. The server is the real enforcer.

After login the app mounts only the navigator for the role in the token. Tokens are kept in the device keychain, never in plain AsyncStorage.

### 3.9 Security Controls

| Area | Control |
| --- | --- |
| Passwords | Argon2id through Spring Security, minimum length 10, breached-password check, lockout after repeated failures |
| Sessions | Short-lived JWT, rotating refresh token stored hashed in the database and kept in Keychain or Keystore on the device, all revoked on password change |
| Input | Bean Validation on every request DTO, JPA parameterized queries, entities never exposed directly (blocks mass assignment) |
| Transport and web | TLS in Spring Boot, strict CORS for the web build, security headers. CSRF protection is off because the API is stateless and uses Bearer tokens |
| Data | AES-GCM encryption of bank details, tax IDs and document bytes through a JPA AttributeConverter, key supplied by environment variable |
| Abuse | In-memory per-IP and per-user rate limit filter on auth and search, daily view caps for researchers counted in research\_access\_log |
| Audit | Append-only audit\_logs table, the application's database user has INSERT and SELECT only on it |
| Mobile | No secrets in the app bundle, screenshot blocking on sensitive screens, optional certificate pinning |

### 3.10 Error Handling and Responses

- 401 not authenticated or token expired, 403 role or field not permitted (the response names the offending field on writes), 404 for records outside scope (avoids leaking existence), 423 account locked, 429 rate limited.
- Consistent error body: `{ "code", "message", "details" }`.

### 3.11 Testing Strategy

- JUnit 5 and Mockito unit tests for the Policy Engine (override beats role, default deny, expiry, masking).
- Authorization matrix tests with MockMvc and Spring Security Test: for every role and endpoint, assert allowed or denied and the exact fields returned.
- Integration tests with @SpringBootTest against a throwaway PostgreSQL database: register to approval to login, refresh rotation and token theft detection.
- Security tests: IDOR attempts (business A reading business B), mass assignment, upload abuse. App tests with Jest and React Native Testing Library.

### 3.12 Spring Boot Implementation Mapping

Package layout of the single application:

```
com.example.directory
  config        SecurityConfig, JwtProperties, CorsConfig, SchedulingConfig
  auth          AuthController, AuthService, JwtService, MfaService, RefreshTokenService
  user          User, UserRepository, UserService, AdminUserController
  business      Business, BusinessRepository, BusinessService, BusinessController
  search        SearchService (native full-text queries, listed businesses only), SearchController
  document      Document, DocumentService, DocumentController, DocumentReviewService
  policy        FieldPolicy, UserPolicyOverride, PolicyEngine, PolicyMap, FieldFilter, PolicyAdminController
  subscription  Plan, Subscription, CreditLedgerEntry, BusinessUnlock, SubscriptionService,
                UnlockService, SubscriptionExpiryJob, PlanAdminController
  listing       ListingSubscription, ListingService, ListingExpiryJob, ListingAdminController
  payment       Payment, PaymentService (manual or gateway implementation), PaymentWebhookController
  audit         AuditLog, AuditService, AuditAspect, AuditController
  common        ApiError, GlobalExceptionHandler, CryptoService (AES-GCM), RateLimitFilter
```

How each concern maps to Spring:

| Concern | Mechanism |
| --- | --- |
| Authentication | JwtAuthenticationFilter in a stateless SecurityFilterChain |
| Role permission | @PreAuthorize with authorities loaded from role\_permissions, for example hasAuthority('business:read') |
| Scope (own business) | @PreAuthorize calling a BusinessScope bean that checks ownership |
| Output field filtering | Controllers return DTOs, a ResponseBodyAdvice runs FieldFilter.filterOutput before serialization |
| Input field filtering | FieldFilter.filterInput in the service layer rejects non-writable fields with 403 |
| Audit | An @Audited annotation and an AOP aspect write audit\_logs in the same transaction |
| Background work | @Scheduled jobs purge expired tokens, unlock accounts and expire user overrides |
| Migrations | Flyway scripts V1\_\_init.sql onward, applied at startup |
| Configuration | application.yml with dev and prod profiles, secrets from environment variables |

### 3.13 Researcher Subscription, Credits and Unlock Logic

**plans**

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK |  |
| code | text unique | BASIC |
| name | text |  |
| credits | int | credits granted per subscription (researcher plans only, null for business plans) |
| duration\_months | int | 1 for Basic |
| price\_amount, currency | numeric, text | 0 for Basic in v1 |
| is\_active | bool | inactive plans cannot be newly subscribed |
| created\_at | timestamptz |  |
| audience | enum(researcher, business) | who can buy the plan |

Seed rows: BASIC (researcher), 5 credits, 1 month, price 0. Business plans LISTING\_1M, LISTING\_1Y and LISTING\_3Y (12 and 36 months for the last two) are seeded with the charge set by the admin.

**subscriptions**

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK |  |
| user\_id | uuid FK users | the researcher |
| plan\_id | uuid FK plans |  |
| status | enum(active, expired, cancelled) |  |
| starts\_at, ends\_at | timestamptz | ends\_at = starts\_at + plan duration, copied at subscribe time so later plan edits never change a running subscription |
| credits\_granted, credits\_remaining | int | copied from the plan |
| cancelled\_at | timestamptz |  |

A partial unique index allows one active subscription per researcher.

**credit\_ledger** (append only): id, user\_id, subscription\_id, entry\_type (grant, spend, expire, admin\_adjust), amount (+5 on grant, -1 on spend, -n on expire), business\_id (null unless a spend), balance\_after, reason, created\_by, created\_at.

**business\_unlocks**: id, user\_id, business\_id, subscription\_id, unlocked\_at. Unique on (subscription\_id, business\_id). Index on (user\_id, business\_id).

**Subscribe**

1. Researcher must be active (documents approved) and have no active subscription.
2. In one transaction: insert the subscription from the plan (credits, starts\_at = now, ends\_at = now + duration), insert a grant ledger entry, write an audit entry.
3. In v1 a PaymentService interface has a no-op implementation, so Basic activates immediately. A real payment provider can be added behind the same interface later.

**Unlock (one credit, one business)**

1. In one @Transactional method, load the researcher's active subscription with a row lock (SELECT ... FOR UPDATE) so two parallel taps cannot spend the same credit twice.
2. Business not currently listed: reject with 404 BUSINESS\_NOT\_LISTED and spend nothing. No active subscription, or ends\_at has passed: reject with 403 SUBSCRIPTION\_REQUIRED.
3. Already unlocked under this subscription: return the full record and charge nothing.
4. credits\_remaining is 0: reject with 403 NO\_CREDITS.
5. Otherwise decrement credits\_remaining, insert a spend ledger entry and a business\_unlocks row, write an audit entry, and return the unlocked record.

**Locking at expiry**

- A business counts as unlocked only while its unlock's subscription is active and ends\_at is in the future. This is checked at read time, so the lock is exact to the second even if a background job is late.
- A @Scheduled job (every few minutes) marks overdue subscriptions expired and writes an expire ledger entry for any leftover credits, setting credits\_remaining to 0. Unlock rows are kept as history and never reused.
- Search results and detail views always pass through the Policy Engine, so locked businesses revert to preview fields immediately.

**Edge cases**

- Cancelled by admin: locks at once, remaining credits expire.
- Plan edited by admin: affects only new subscriptions.
- After expiry the researcher can subscribe again. The new subscription grants fresh credits, and previously unlocked businesses are locked until unlocked again with a credit.
- Admin credit changes are ledger entries with a mandatory reason.
- Search can filter only on preview fields, so a locked field cannot be inferred through search.

### 3.14 Business Listing, Payments and Unlisting

**listing\_subscriptions**

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK |  |
| business\_id | uuid FK businesses |  |
| purchased\_by | uuid FK users | the business user |
| plan\_id | uuid FK plans | audience = business |
| status | enum(pending\_payment, active, expired, cancelled) |  |
| starts\_at, ends\_at | timestamptz | set when payment is confirmed |
| amount, currency | numeric, text | copied from the plan at purchase, so later price changes never alter a purchase |
| payment\_id | uuid FK payments |  |
| created\_at | timestamptz |  |

**payments**

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK |  |
| user\_id | uuid FK users | who pays |
| purpose | enum(listing, researcher\_plan) |  |
| reference\_id | uuid | the listing or researcher subscription it pays for |
| amount, currency | numeric, text | 0 for Basic |
| provider | text | manual, or the gateway name |
| provider\_ref | text unique | gateway transaction id, makes the webhook idempotent |
| status | enum(pending, paid, failed, refunded) |  |
| recorded\_by | uuid FK users | admin, for manual payments |
| created\_at, paid\_at | timestamptz |  |

**Buying a listing**

1. The business calls POST /my/listing with a plan code. The server creates a listing\_subscription (pending\_payment) and a payment (pending) at the plan's current charge.
2. Payment is confirmed in one of two ways, both ending in PaymentService.markPaid: an admin records the offline payment in the control panel, or a gateway calls the signature-checked webhook.
3. markPaid runs in one transaction: payment becomes paid, the subscription becomes active, starts\_at = the later of now and the business's current listed\_until, ends\_at = starts\_at + the plan duration, and businesses.listed\_until is set to ends\_at. An audit entry is written.
4. The business is now listed. A pending payment not confirmed within 24 hours is expired by a scheduled job.

**Who sees what**

- Visible to researchers means the owner is approved, admin\_listing\_status is listed and listed\_until is in the future. This is evaluated at read time, so unlisting is exact to the second even if a background job is late.
- Search adds the listed condition to its SQL WHERE clause. Detail and unlock check it in the service layer. Both return 404 for an unlisted business.
- Business owner: always sees and edits their own record, with a banner giving the listing state and the expiry date, plus the plan choices.
- Auditor and admin: see every business, with a listing\_status field.
- Researcher: sees listed businesses only. Unlocks made earlier stay in business\_unlocks and take effect again if the business is relisted while the researcher's subscription is still active.

The listing\_status returned to the owner, auditor and admin is derived in this order, first match wins:

| listing\_status | Condition | Visible to researchers |
| --- | --- | --- |
| not\_approved | The owner's profile has not been approved yet | No |
| unlisted\_by\_admin | Approved, but admin\_listing\_status is unlisted (the starting state) | No |
| awaiting\_plan | Admin has listed it, but no plan has been paid yet | No |
| expired | Admin has listed it, but the last paid period has ended | No |
| listed | Admin has listed it and listed\_until is in the future | Yes |

**Expiry**

- A @Scheduled ListingExpiryJob marks listing\_subscriptions expired once ends\_at has passed and emails the owner a reminder 7 days before expiry (only if SMTP is configured).
- Nothing is deleted. The business row, documents, audit history and unlock history all remain.

**Edge cases**

- Admin cancels a listing: listed\_until is set to now and the business unlists at once.
- Admin unlists a business: admin\_listing\_status becomes unlisted, so it is hidden even though the plan is paid. Listing it again restores it.
- Refunds are not automatic. The admin marks the payment refunded and cancels the listing.
- A price change affects new purchases only.
- The gateway, if used, is an outbound HTTPS call plus one webhook endpoint inside the monolith. It adds no deployed component, but it is an external service.

Assumption: the admin's list switch keeps its setting when a plan expires and is later renewed, so a renewed business reappears without the admin acting again. If you want the admin to list it again after every expiry, the expiry job can reset the switch to unlisted.

### 3.15 Progressive Registration and Profile Completion

**Data rules**

- Only users.full\_name, email, password\_hash, role and (for a business) businesses.legal\_name are required at registration. Every other column in researcher\_profiles and businesses is nullable.
- A new table `profile_requirements` (role, kind, name, is\_required) lists the profile fields and document types needed for submission. The admin edits it from Settings, so no code change is needed to change what is mandatory.
- The draft business row has owner\_user\_id set and listed\_until null, so it is never visible to researchers. Admins see it tagged as incomplete.

**Saving and submitting**

1. PATCH /me/profile and PATCH /my/business accept partial payloads. They validate the format of what is sent (phone, email, tax ID pattern) but do not demand missing fields. The usual field policy still decides which fields the user may write.
2. GET /me/profile/completion runs ProfileCompletionService, which compares the stored profile and uploaded documents (rejected documents do not count) against profile\_requirements and returns the percent complete plus the exact missing items. The app's checklist screen renders this.
3. POST /me/submit-for-review repeats that check. If anything is missing it returns 422 listing it. Otherwise status becomes pending\_review, submitted\_at is set and the user appears in the admin review queue.
4. While pending\_review the profile and documents are read-only (409 on edit), so the reviewer sees a stable snapshot.
5. On rejection, status returns to pending\_profile, review\_note holds the reason, and editing reopens.

**Restricted session**

- The JWT carries the role only. On each request the security filter reads the user's current status from the database and grants authorities from it: pending\_profile and rejected users get profile:edit, document:upload and status:read, and active users get the full role permissions.
- Because status is read per request, approval takes effect immediately without logging in again.

**Nudges**

- A @Scheduled job emails users who stay in pending\_profile for 3 and 7 days (only if SMTP is configured). The app also shows the checklist banner on every launch until submission.

**Assumptions**

- Business plans, researcher subscriptions and unlocking all require status active, so they open only after approval.
- Edits to identity fields (legal name, registration number, tax ID) after approval take effect immediately in this design. A rule sending them back for re-review can be added if you want one.

### 3.16 Guest Home and Role-Based Entry

**Routing**

RootNavigator decides the first screen from the session state:

1. No token: guest stack (Home, the two landing pages, Login, Register).
2. Token, user status pending\_profile, pending\_review or rejected: onboarding stack (checklist, profile form, document upload, review status).
3. Token, status active: the navigator of the user's role.

**Screens and URLs**

| Route | Screen | Notes |
| --- | --- | --- |
| / | Home | Two cards: I am a business, I am a research member / investor. A Log in link sits beside them |
| /business | BusinessLanding | Benefits, listing plan cards from the public plans API, Register and Log in buttons |
| /researcher | ResearcherLanding | How search, credits and unlocking work, Basic plan card, Register and Log in buttons |
| /register?role=business or researcher | Register | Role preset and not editable. The business variant adds the business name field |
| /login | Login | Same screen for every role |

**Behaviour**

- Tapping a card opens that landing page and stores the chosen role in secure storage, so the choice survives if the visitor leaves before registering. The Register button passes it as the role parameter.
- POST /auth/register still validates the role on the server. Only researcher and business are accepted, whatever the app sends.
- Login ignores the stored choice. A business user who taps the researcher card and logs in simply lands in the business portal.
- Guests can call only /auth/\* and /public/plans. Search and business details always require a login, so a guest never receives business data.
- Public endpoints go through the same in-memory rate limiter and return no personal data.

**Website note**

The home and landing pages are screens of the React Native app, published to the browser through react-native-web, with the routes above as shareable URLs. A client-rendered app is indexed less well by search engines. If search visibility of these pages matters, Spring Boot can serve them as static HTML itself (still one application, no new component), with their buttons opening the app's register and login routes.

## 4. Implementation Roadmap

| Phase | Deliverable |
| --- | --- |
| 1 | Spring Boot project with Flyway schema, auth (basic registration, login, verify, refresh, MFA), profile completion and submit for review, seeded admin, React Native shell with the guest home, role choice and login |
| 2 | RBAC, scope checks, Policy Engine with field filtering, audit logging |
| 3 | Business and researcher portals, search, document upload, plans, credits and unlock, business listing plans, payments and unlisting |
| 4 | Admin control panel: users, document review, visibility matrix, preview-as |
| 5 | Auditor portal, audit log viewer, hardening, tests, deployment |

## 5. Open Decisions

1. Should one user be able to hold multiple roles (for example a researcher who also owns a business)? The model uses a single role. A user\_roles join table supports multiple.
2. Can one business have several user accounts (owner plus staff)? If yes, add a business\_members table.
3. Which fields must be masked versus fully hidden for researchers? The defaults in section 3.2 are a starting point.
4. Email verification, password reset and expiry reminders need an SMTP server, the one outbound integration. If none is allowed, verification and reset codes are issued by an admin from the control panel.
5. Caches and rate limits live in the JVM, so the backend runs as one instance. Several instances would need those moved into database tables.
6. Documents live in PostgreSQL, which suits thousands of files of a few MB each. Much larger volumes would call for a different storage approach.
7. Payment for business listing plans: use a payment gateway (an external service, outside the database-only rule) or have an admin record offline payments? The design supports both behind one PaymentService interface. The Basic researcher plan needs no payment in v1.
8. What are the charges for the 1 month, 1 year and 3 year listing plans? The admin sets them in the control panel, so nothing is hard-coded.
9. Renewing before expiry adds the new period after the current end date. The design assumes this.
10. Is 1 month a calendar month from the start (for example Oct 25 to Nov 25)? The design assumes yes, for both researcher and business plans.
11. Does an unlocked business show every field except bank\_details? The design assumes yes, and admin can open bank\_details too.
12. If a business is suspended, deleted or unlisted after a researcher unlocked it, is the credit refunded? The design assumes no.
