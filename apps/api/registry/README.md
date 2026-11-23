# Component registry source

Published component source is versioned in this Git tree, outside PostgreSQL:

```text
registry/<component-slug>/<latest-version>/
```

`component_releases` records each component version, and
`component_release_files` records the allowed paths and SHA-256 checksums. The
API serves only ledger paths for the release matching a published Free
component's `latest_version`; it does not discover files by scanning the
directory. Missing matching release returns 404. Missing files or invalid
checksums return 500 without source content.

The API validates slugs, versions, and paths before reading files. Symlinks,
hidden files, unsupported file types, invalid UTF-8, and oversized releases
are rejected. The release directory and ledger entries must be prepared before
updating a component's `latest_version`; this read endpoint does not create or
update release records.

Do not store component source in the `components` table. This directory is
copied into the API build output for Docker; the API Vercel service explicitly
includes it in the function bundle.
