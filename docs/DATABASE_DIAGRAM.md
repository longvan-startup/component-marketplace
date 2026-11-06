# Database diagrams

This document separates the tables currently defined in the database package from the proposed Forum/Chat model. The source files under [`docs/assets/`](assets/) are editable Mermaid ERDs.

## Current schema

This diagram reflects `packages/db/src/schema.ts` and migrations `0000`–`0005` on the current feature branch. Migration `0005` is new and has not been merged or applied to a shared database. The schema contains five tables: `users`, `sessions`, `accounts`, `verifications`, and `components`.

`UK` marks an existing unique index. User email uniqueness is case-insensitive; accounts have a unique `(provider_id, account_id)` pair. `verifications` has no foreign key. These details come from the schema and migration SQL, not from assumptions about Better Auth.

```mermaid
%% Current feature-branch database schema; migration 0005 is not yet merged/applied.
%% Source of truth: packages/db/src/schema.ts and packages/db/drizzle/0000-0005.
%% Index names and delete actions are also summarized in docs/DATABASE_DIAGRAM.md.
erDiagram
    users ||--o{ sessions : "user_id CASCADE"
    users ||--o{ accounts : "user_id CASCADE"
    users o|--o{ components : "author_id SET NULL"

    users {
        uuid id PK "NOT NULL DEFAULT gen_random_uuid()"
        text email UK "NOT NULL; unique on lower(email)"
        text name "NOT NULL"
        boolean email_verified "NOT NULL DEFAULT false"
        text image "NULL"
        user_role role "NOT NULL DEFAULT user; user|seller|admin"
        timestamptz created_at "NOT NULL DEFAULT now()"
        timestamptz updated_at "NOT NULL DEFAULT now()"
    }
    sessions {
        text id PK "NOT NULL"
        timestamptz expires_at "NOT NULL"
        text token UK "NOT NULL; sessions_token_unique"
        timestamptz created_at "NOT NULL DEFAULT now()"
        timestamptz updated_at "NOT NULL DEFAULT now()"
        text ip_address "NULL"
        text user_agent "NULL"
        uuid user_id FK "NOT NULL; sessions_user_id_idx; ON DELETE CASCADE"
    }
    accounts {
        text id PK "NOT NULL"
        text account_id "NOT NULL; unique with provider_id"
        text provider_id "NOT NULL; unique with account_id"
        uuid user_id FK "NOT NULL; accounts_user_id_idx; ON DELETE CASCADE"
        text access_token "NULL"
        text refresh_token "NULL"
        text id_token "NULL"
        timestamptz access_token_expires_at "NULL"
        timestamptz refresh_token_expires_at "NULL"
        text scope "NULL"
        text password "NULL"
        timestamptz created_at "NOT NULL DEFAULT now()"
        timestamptz updated_at "NOT NULL DEFAULT now()"
    }
    verifications {
        text id PK "NOT NULL"
        text identifier "NOT NULL; verifications_identifier_idx"
        text value "NOT NULL"
        timestamptz expires_at "NOT NULL"
        timestamptz created_at "NOT NULL DEFAULT now()"
        timestamptz updated_at "NOT NULL DEFAULT now()"
    }
    components {
        uuid id PK "NOT NULL DEFAULT gen_random_uuid()"
        text slug UK "NOT NULL; components_slug_unique"
        text name "NOT NULL"
        text description "NULL"
        catalog_category category "NOT NULL; animation|react-component|tool"
        varchar_array tags "NOT NULL DEFAULT empty array; max 12, each <=40"
        text latest_version "NOT NULL DEFAULT 0.0.0"
        boolean is_published "NOT NULL DEFAULT false"
        integer price_amount_minor "NULL; positive when set"
        varchar price_currency "NULL; uppercase 3-letter code paired with amount"
        boolean requires_payment_for_update "NOT NULL DEFAULT false; requires price"
        uuid author_id FK "NULL; ON DELETE SET NULL"
        timestamptz created_at "NOT NULL DEFAULT now()"
        timestamptz updated_at "NOT NULL DEFAULT now()"
    }

    classDef db fill:#fffbeb,stroke:#f59e0b,stroke-width:2px,color:#78350f;
    classDef auth fill:#fff1f2,stroke:#f43f5e,stroke-width:2px,color:#881337;
    class users auth;
    class sessions auth;
    class accounts auth;
    class verifications auth;
    class components db;
```

Index list:

| Table | Indexes from Drizzle schema/migrations |
|---|---|
| `users` | unique `users_email_lower_unique(lower(email))` |
| `sessions` | unique `sessions_token_unique(token)`; `sessions_user_id_idx(user_id)` |
| `accounts` | `accounts_user_id_idx(user_id)`; unique `accounts_provider_account_unique(provider_id, account_id)` |
| `verifications` | `verifications_identifier_idx(identifier)` |
| `components` | unique `components_slug_unique(slug)`; GIN `components_tags_gin_idx(tags)` |

Catalog checks enforce the shared slug, name, description, category, tag, version, and price rules. `price_amount_minor` and `price_currency` describe catalog pricing only; they do not create a payment, purchase, or entitlement record. `latest_version` remains a pointer, not release history.

## Forum and Chat model — proposed

The gray entities are from [`docs/COMMUNITY_ARCHITECTURE.md`](COMMUNITY_ARCHITECTURE.md), section 6. They are **proposals only**: they are not in `schema.ts` or the merged migrations, and issue [#68](https://github.com/longvan-startup/component-marketplace/issues/68) is still open for owner confirmation. The diagram shows the five current tables as context plus nine proposed tables (14 entities total).

The ERD intentionally excludes `chat_memberships` (the RFC says it is not in the MVP) and does not add seller, payment, entitlement, or purchase tables. Proposed indexes and uniqueness rules below come from the RFC and are not implemented database constraints. The shared-contract RFC still has pending decisions, so the ERD follows the base architecture where the documents differ and calls out those differences below.

```mermaid
%% PROPOSED ONLY — not present in schema.ts or any merged migration.
%% Based on docs/COMMUNITY_ARCHITECTURE.md section 6; owner review tracked by issue #68.
%% Existing tables reflect the current feature branch (migration 0005 is pending); gray tables are proposed.
%% Conflicting and unresolved RFC-05/RFC-08 details are documented in docs/DATABASE_DIAGRAM.md.
erDiagram
    users ||--o{ sessions : "current; CASCADE"
    users ||--o{ accounts : "current; CASCADE"
    users o|--o{ components : "current author; SET NULL"

    users ||--o{ forum_reactions : "CASCADE"
    users ||--o{ forum_thread_follows : "CASCADE"
    users ||--o{ chat_read_states : "CASCADE"
    users o|--o{ forum_threads : "author; SET NULL"
    users o|--o{ forum_replies : "author; SET NULL"
    users o|--o{ forum_replies : "deleted_by; SET NULL"
    users o|--o{ forum_reports : "reporter; SET NULL"
    users o|--o{ forum_reports : "resolver; SET NULL"
    users o|--o{ chat_messages : "author; SET NULL"
    users o|--o{ chat_messages : "deleted_by; SET NULL"

    forum_categories ||--o{ forum_threads : "category; RESTRICT"
    components o|--o{ forum_threads : "component; SET NULL"
    components o|--o{ forum_threads : "released component; SET NULL"
    forum_threads ||--o{ forum_replies : "thread; CASCADE"
    forum_replies o|--o{ forum_replies : "parent reply; nullable"
    forum_threads o{--o| forum_replies : "accepted reply; nullable FK"
    forum_threads ||--o{ forum_thread_follows : "CASCADE"
    forum_threads o|--o{ forum_reactions : "target; CASCADE"
    forum_replies o|--o{ forum_reactions : "target; CASCADE"
    forum_threads o|--o{ forum_reports : "target; CASCADE"
    forum_replies o|--o{ forum_reports : "target; CASCADE"
    chat_channels ||--o{ chat_messages : "channel; CASCADE"
    chat_channels ||--o{ chat_read_states : "CASCADE"

    users {
        uuid id PK "CURRENT"
        text email UK "CURRENT; case-insensitive unique"
        text name "CURRENT"
        user_role role "CURRENT user|seller|admin"
    }
    sessions {
        text id PK "CURRENT"
        text token UK "CURRENT"
        uuid user_id FK "CURRENT; CASCADE"
    }
    accounts {
        text id PK "CURRENT"
        text account_id "CURRENT; unique with provider_id"
        text provider_id "CURRENT; unique with account_id"
        uuid user_id FK "CURRENT; CASCADE"
    }
    verifications {
        text id PK "CURRENT"
        text identifier "CURRENT; indexed"
        text value "CURRENT"
    }
    components {
        uuid id PK "CURRENT"
        text slug UK "CURRENT"
        catalog_category category "CURRENT"
        varchar_array tags "CURRENT; max 12, each <=40"
        integer price_amount_minor "CURRENT; catalog metadata"
        varchar price_currency "CURRENT; paired with amount"
        boolean requires_payment_for_update "CURRENT; requires price"
        uuid author_id FK "CURRENT; nullable; SET NULL"
    }
    forum_categories {
        uuid id PK "PROPOSED"
        varchar slug "PROPOSED"
        varchar name "PROPOSED"
        text description "PROPOSED; nullable"
    }
    forum_threads {
        uuid id PK "PROPOSED"
        uuid category_id FK "NOT NULL; RESTRICT"
        uuid author_id FK "nullable; SET NULL"
        uuid component_id FK "nullable; SET NULL"
        varchar title "NOT NULL"
        varchar slug UK "NOT NULL"
        text body "markdown"
        forum_thread_type thread_type "question|showcase|idea|feedback|announcement"
        uuid accepted_reply_id FK "nullable; SET NULL; uniqueness not specified"
        forum_idea_status idea_status "nullable; planned|in_progress|released|rejected"
        uuid released_component_id FK "nullable; SET NULL"
        boolean is_locked "moderation flag"
        boolean is_pinned "moderation flag"
        integer reply_cache "denormalized"
        integer upvote_cache "denormalized"
        timestamptz last_activity_at "feed ordering"
        timestamptz deleted_at "nullable tombstone"
        uuid deleted_by FK "nullable; SET NULL"
    }
    forum_replies {
        uuid id PK "PROPOSED"
        uuid thread_id FK "NOT NULL; CASCADE"
        uuid author_id FK "nullable; SET NULL"
        uuid parent_reply_id FK "nullable self-reference"
        integer depth "0..4"
        text body "NOT NULL"
        timestamptz deleted_at "nullable tombstone"
        uuid deleted_by FK "nullable; SET NULL"
    }
    forum_reactions {
        uuid id PK "PROPOSED"
        uuid user_id FK "NOT NULL; CASCADE"
        forum_target_kind target_kind "thread|reply"
        uuid thread_id FK "nullable; CASCADE"
        uuid reply_id FK "nullable; CASCADE"
        forum_reaction_kind kind "upvote in MVP"
    }
    forum_thread_follows {
        uuid user_id PK,FK "PROPOSED; CASCADE"
        uuid thread_id PK,FK "PROPOSED; CASCADE"
        timestamptz created_at "PROPOSED"
    }
    forum_reports {
        uuid id PK "PROPOSED"
        uuid reporter_id FK "nullable; SET NULL"
        forum_target_kind target_kind "thread|reply"
        uuid thread_id FK "nullable; CASCADE"
        uuid reply_id FK "nullable; CASCADE"
        forum_report_reason reason "spam|offensive|off_topic|copyright|other"
        text details "nullable"
        forum_report_status status "open|resolved|dismissed"
        uuid resolver_id FK "nullable; SET NULL"
        timestamptz resolved_at "nullable"
    }
    chat_channels {
        uuid id PK "PROPOSED"
        varchar slug UK "PROPOSED"
        varchar display_name "PROPOSED"
        text description "nullability not specified"
        integer sort_order "PROPOSED"
        boolean is_active "PROPOSED"
    }
    chat_messages {
        uuid id PK "PROPOSED"
        uuid channel_id FK "NOT NULL; CASCADE"
        bigserial seq "order design pending RFC-08 review"
        uuid author_id FK "nullable; SET NULL"
        uuid client_message_id "idempotency key"
        text body "<= 2000 characters"
        timestamptz deleted_at "nullable tombstone"
        uuid deleted_by FK "nullable; SET NULL"
    }
    chat_read_states {
        uuid user_id PK,FK "PROPOSED; CASCADE"
        uuid channel_id PK,FK "PROPOSED; CASCADE"
        bigint last_read_seq "unread watermark"
        timestamptz updated_at "PROPOSED"
    }

    classDef db fill:#fffbeb,stroke:#f59e0b,stroke-width:2px,color:#78350f;
    classDef auth fill:#fff1f2,stroke:#f43f5e,stroke-width:2px,color:#881337;
    classDef state fill:#f8fafc,stroke:#64748b,stroke-width:2px,color:#0f172a;
    class users auth;
    class sessions auth;
    class accounts auth;
    class verifications auth;
    class components db;
    class forum_categories state;
    class forum_threads state;
    class forum_replies state;
    class forum_reactions state;
    class forum_thread_follows state;
    class forum_reports state;
    class chat_channels state;
    class chat_messages state;
    class chat_read_states state;
```

Open points recorded in the shared-contract RFC; none are approved schema changes:

- `users.role` is currently `user|seller|admin`. RFC-02 proposes adding `moderator`, but that migration is pending owner confirmation.
- `forum_threads.accepted_reply_id` is nullable. The proposal does not define a unique constraint, and RFC-04 leaves same-thread/type validation to a service transaction that has not been implemented.
- The architecture document proposes unique `chat_messages(channel_id, client_message_id)`. RFC-05 flags cross-user collisions and proposes adding `author_id` to that key; it also proposes `client_message_id` and a unique key on `forum_replies`, which the base ERD does not define.
- The architecture calls `chat_messages.seq` a monotonic replay cursor. RFC-08 notes a commit-order race with `bigserial` and leaves the ordering approach pending review. The ERD does not claim the current proposal solves this race.

Proposed indexes from the architecture/RFC documents:

| Table/use | Proposed index or uniqueness rule |
|---|---|
| Threads | unique `slug`; `(category_id, last_activity_at DESC)` for feed, partial on active rows; partial `(component_id)` for component discussions |
| Replies | `(thread_id, created_at)`; RFC-05 separately proposes adding `client_message_id` and unique `(thread_id, author_id, client_message_id)` |
| Reactions | partial unique `(user_id, thread_id)` when `reply_id IS NULL`; partial unique `(user_id, reply_id)` when `thread_id IS NULL` |
| Thread follows | composite unique/primary key `(user_id, thread_id)` |
| Reports | partial `(status, created_at)` for open reports |
| Chat channels | unique `slug` |
| Chat messages | Architecture baseline: unique `(channel_id, client_message_id)` for idempotency; RFC-05 proposes adding `author_id` to this key; `(channel_id, seq)` for history/replay, with ordering strategy pending RFC-08 |
| Chat read states | composite unique/primary key `(user_id, channel_id)` |

## Export format

The editable `.mmd` files are the source deliverable. This repository's `diagram-design` instructions do not provide or permit a PNG-rendering workflow, so this change does not attach PNG/SVG/PDF exports. The diagrams are also embedded above as Mermaid blocks so GitHub can display them in this document.
