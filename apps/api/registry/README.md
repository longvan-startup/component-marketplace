# Component registry source

Published component source is versioned in this Git tree, outside PostgreSQL:

```text
registry/<component-slug>/<latest-version>/
```

The API serves text files from the exact `latest_version` recorded for a
published Free component. A release directory must contain at least one
supported text file. Slug and version are validated before they are used as
path segments. Symlinks, hidden files, unsupported file types, invalid UTF-8,
and oversized releases are rejected.

Add a new release by adding its files under a new version directory and
updating the catalog row through the existing admin workflow. Do not store
component source in the `components` table. This directory is copied into the
API build output for Docker; the API Vercel service explicitly includes it in
the function bundle.
