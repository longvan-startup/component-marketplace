# Component registry source

Published component source is versioned in this Git tree, outside PostgreSQL:

```text
registry/<component-slug>/<latest-version>/
```

The database keeps three normalized records for the installable catalog: `components` stores catalog metadata and the current release pointer; `component_releases` stores one row for each component version; and `component_release_files` stores each relative source path with its SHA-256 digest. Source text stays in this repository. The API serves only ledger paths for the release matching a published Free component's `latest_version`; it does not discover files by scanning the directory. Missing matching release returns 404. Missing files or invalid checksums return 500 without source content.

The API validates slugs, versions, and paths before reading files. Symlinks, hidden files, unsupported file types, invalid UTF-8, and oversized releases are rejected. The release directory and ledger entries must be prepared before updating a component's `latest_version`; this read endpoint does not create or update release records.

## Image Accordion 1.0.0 development registration

The checked-in release is installed into a local PostgreSQL database only by an explicit development command. It is not a production seed or migration. Start a disposable local database, apply the workspace migrations, then register the release:

```sh
bun run db:migrate
IMAGE_ACCORDION_DEV_DATABASE_URL=postgres://user:password@127.0.0.1:5432/component_marketplace bun apps/api/scripts/register-image-accordion.ts
```

The command rejects production mode and non-local database hosts. It verifies every source file before writing, records the metadata, version, paths and checksums in the existing tables, and is safe to run again when the existing release matches the checked-in bytes. To make the source available through the API, use a live API with that development database and open `/components/image-accordion` with `API_MODE=live`. Production catalog data must be managed through the owner-approved release workflow.

Do not store component source in the `components` table. This directory is copied into the API build output for Docker; the API Vercel service explicitly includes it in the function bundle.
