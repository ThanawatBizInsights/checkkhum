# CheckKhum customer database

Supabase PostgreSQL. Schema changes live in versioned migrations in
[`supabase/migrations/`](../supabase/migrations); never edit a migration that
has been applied. Add a new one with `npx supabase migration new <name>`.

| Migration | Contents |
|---|---|
| `20261005060000_base_types_and_helpers.sql` | Enum types, `private` schema, `updated_at` and append-only trigger functions |
| `20261005060100_core_tables.sql` | The 11 tables, constraints, indexes, rate-limit table |
| `20261005060200_audit_and_automation.sql` | Audit-log triggers; automatic renewal tasks |
| `20261005060300_access_control.sql` | Grants, row level security policies, staff role helpers |
| `20261005060400_enquiry_intake.sql` | `submit_enquiry` and `consume_rate_limit` (server only) |

## Entity relationship diagram

Rendered copy: [`database-erd.png`](database-erd.png).

```mermaid
erDiagram
    AUTH_USERS ||--o| STAFF_USERS : "is"
    CUSTOMERS ||--o{ VEHICLES : owns
    CUSTOMERS ||--o{ ENQUIRIES : makes
    VEHICLES |o--o{ ENQUIRIES : "is about"
    STAFF_USERS |o--o{ ENQUIRIES : "assigned to"
    ENQUIRIES ||--o{ QUOTATIONS : receives
    INSURERS ||--o{ QUOTATIONS : offers
    STAFF_USERS |o--o{ QUOTATIONS : prepares
    CUSTOMERS ||--o{ POLICIES : holds
    VEHICLES |o--o{ POLICIES : covers
    INSURERS ||--o{ POLICIES : issues
    QUOTATIONS |o--o| POLICIES : "becomes"
    POLICIES ||--o{ RENEWAL_TASKS : "renewal of"
    STAFF_USERS |o--o{ RENEWAL_TASKS : "assigned to"
    CUSTOMERS ||--o{ FOLLOW_UP_ACTIVITIES : "contacted in"
    ENQUIRIES |o--o{ FOLLOW_UP_ACTIVITIES : about
    POLICIES |o--o{ FOLLOW_UP_ACTIVITIES : about
    STAFF_USERS |o--o{ FOLLOW_UP_ACTIVITIES : logs
    CUSTOMERS ||--o{ CONSENT_RECORDS : gives
    ENQUIRIES |o--o{ CONSENT_RECORDS : "captured with"
    STAFF_USERS |o--o{ CONSENT_RECORDS : records
    STAFF_USERS |o--o{ AUDIT_LOGS : "acts in"

    AUTH_USERS {
        uuid id PK "Supabase Auth"
    }
    STAFF_USERS {
        uuid id PK,FK "auth.users.id"
        text email UK
        text full_name
        staff_role role "admin | agent | viewer"
        boolean is_active
    }
    CUSTOMERS {
        uuid id PK
        text full_name
        text phone UK "digits, 0XXXXXXXXX"
        text email
        text line_id
        contact_channel preferred_channel
        text notes
    }
    VEHICLES {
        uuid id PK
        uuid customer_id FK
        text description "as typed, e.g. Honda City"
        text make
        text model
        smallint model_year
        boolean is_ev
        text registration_plate
        text plate_province
    }
    INSURERS {
        uuid id PK
        text code UK
        text name_th
        text name_en
        boolean is_active
    }
    ENQUIRIES {
        uuid id PK
        text reference UK "CK-YYMMDD-XXXX"
        uuid customer_id FK
        uuid vehicle_id FK
        enquiry_type type "quote | contact"
        insurance_product product
        enquiry_status status
        enquiry_source source
        text contact_name "as submitted"
        text contact_phone "as submitted"
        text travel_destination
        smallint travel_days
        smallint travellers
        text message
        uuid assigned_to FK
        uuid idempotency_key UK
        text fingerprint "duplicate detection"
        text client_ip_hash "salted SHA-256"
    }
    QUOTATIONS {
        uuid id PK
        uuid enquiry_id FK
        uuid insurer_id FK
        insurance_product product
        numeric sum_insured
        numeric premium
        numeric deductible
        text repair_type "dealer | garage"
        date valid_until
        quotation_status status
        uuid prepared_by FK
    }
    POLICIES {
        uuid id PK
        uuid customer_id FK
        uuid vehicle_id FK
        uuid insurer_id FK
        uuid quotation_id FK,UK
        insurance_product product
        text policy_number "unique per insurer"
        date start_date
        date end_date
        numeric premium
        policy_status status
    }
    RENEWAL_TASKS {
        uuid id PK
        uuid policy_id FK
        uuid assigned_to FK
        date due_date "end_date - 45 days"
        task_status status
        timestamptz completed_at
    }
    FOLLOW_UP_ACTIVITIES {
        uuid id PK
        uuid customer_id FK
        uuid enquiry_id FK
        uuid policy_id FK
        uuid staff_user_id FK
        activity_type activity_type
        text summary
        text outcome
        timestamptz occurred_at
        timestamptz next_action_at
    }
    CONSENT_RECORDS {
        uuid id PK
        uuid customer_id FK
        uuid enquiry_id FK
        consent_purpose purpose
        boolean granted
        text notice_version
        consent_method method
        uuid recorded_by FK
        timestamptz captured_at
    }
    AUDIT_LOGS {
        bigint id PK
        timestamptz occurred_at
        uuid actor_id "auth.uid()"
        text actor_role
        text action "insert | update | delete"
        text table_name
        text record_id
        jsonb old_values
        jsonb new_values
    }
```

Every table also has `created_at`, and mutable tables have `updated_at`
(maintained by trigger). The non-exposed `private.rate_limit_buckets` table
backs rate limiting and holds only salted hashes.

### Design notes

- **One customer per phone number.** Web enquiries are matched to customers by
  phone. The public form never overwrites an existing customer's details;
  what the visitor typed is kept on the enquiry (`contact_name`, `contact_phone`).
- **Consent is append-only evidence.** Each web enquiry records
  `quote_processing` (granted) and the visitor's `marketing` choice, with the
  privacy notice version shown. A withdrawal is a new row with
  `granted = false`. Updates and deletes are blocked by trigger for every
  role.
- **Audit logs** are written by triggers on every customer table: who
  (`auth.uid()` and database role), what, and for updates only the changed
  columns. They cannot be edited or deleted, even with the secret key.
- **Renewal tasks** are created automatically 45 days before a policy ends
  when it becomes `active`.
- **Deletion.** Customers with enquiries, policies, consent records or
  activities cannot be deleted (`on delete restrict`). Handle PDPA erasure
  requests as a deliberate admin process (anonymise the record), not a
  cascade.
- **Not stored:** national ID numbers, dates of birth, raw IP addresses.
  Add sensitive fields only with a lawful basis and a migration that also
  updates the privacy notice.

## Access control

Row level security is enabled on every table. Supabase's default grants to
`anon` and `authenticated` are revoked explicitly before granting only what
each role needs.

| Who | How they connect | customers, vehicles, enquiries, quotations, policies, follow-ups, renewal tasks | insurers | consent records | staff users | audit logs | `submit_enquiry`, `consume_rate_limit` |
|---|---|---|---|---|---|---|---|
| Public visitor | Publishable key (`anon`) | none | none | none | none | none | none |
| Signed-in user not in `staff_users` (or inactive) | `authenticated` | none | none | none | none | none | none |
| Staff: viewer | `authenticated` | read | read | read | read | none | none |
| Staff: agent | `authenticated` | read, add, edit | read | read, add (phone/LINE/paper only) | read | none | none |
| Staff: admin | `authenticated` | read, add, edit, delete | full | read, add | full | read | none |
| Website server | Secret key (`service_role`) | bypasses RLS | | | | | execute |

Visitors create enquiries only through `POST /api/enquiries` on the website
server, which calls `submit_enquiry` with the secret key. Because `anon` cannot
execute that function, the endpoint's validation, spam checks and rate limits
cannot be skipped by calling Supabase directly.

## Enquiry intake flow

```mermaid
sequenceDiagram
    participant V as Visitor's browser
    participant A as POST /api/enquiries (Next.js server)
    participant D as Supabase Postgres
    V->>A: JSON enquiry + idempotency key, start time, honeypot, [Turnstile token]
    A->>A: content type, origin, size, zod validation
    A->>A: honeypot empty? filled in ≥ 2.5 s? few links? [Turnstile valid?]
    A->>D: consume_rate_limit(ip hash) and (phone hash)
    D-->>A: allowed / retry after
    A->>D: submit_enquiry(payload)
    D->>D: lock on request fingerprint
    D->>D: idempotency key seen? same request in last 30 min? → return existing
    D->>D: find/create customer and vehicle, create enquiry, record consent
    D-->>A: reference, duplicate flag
    A-->>V: 201 {reference} or 200 {reference, duplicate: true}
```

| Protection | Where | Limit |
|---|---|---|
| Validation | `src/lib/server/enquiry-validation.ts` + table constraints | Thai phone, lengths, ranges, known plans |
| Honeypot field | form + endpoint | must be empty |
| Minimum fill time | form + endpoint | 2.5 s |
| Link spam | endpoint | no links in name; fewer than 3 in message |
| Cloudflare Turnstile | form + endpoint | optional, on when keys are set |
| Rate limit per IP | `consume_rate_limit` | 5 per 10 minutes |
| Rate limit per phone | `consume_rate_limit` | 5 per hour |
| Idempotency key | `enquiries.idempotency_key` unique | double-clicks, retries |
| Same-request window | `submit_enquiry` fingerprint | 30 minutes |
| Concurrency | advisory lock on fingerprint | identical parallel requests |

## Testing

```bash
npm run db:start          # local Supabase (Docker)
npm run db:reset          # apply migrations + fictional seed
npm run db:test           # pgTAP: 42 access-control and intake assertions
npm run db:lint
npm run build && npm start                          # with .env.local → local Supabase
BASE_URL=http://localhost:3000 npm run verify:enquiries   # 31 end-to-end API checks
```

`verify:enquiries` refuses to run unless Supabase is local, because it
creates rows.

Seed logins (local only, password `checkkhum-local-only`):
`admin@checkkhum.example`, `agent@checkkhum.example`, `viewer@checkkhum.example`.
