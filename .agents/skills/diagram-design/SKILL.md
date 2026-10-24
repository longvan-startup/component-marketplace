---
name: diagram-design
description: Design and style clear, high-contrast Mermaid architecture diagrams, sequence flows, and ERDs. Component-marketplace has no diagram render pipeline yet — author/fix `.mmd` sources and inline mermaid blocks only; do not attempt PNG rendering.

---

# Diagram Design Standards

Standardized methodology for authoring professional, high-contrast, beautiful Mermaid diagrams in this monorepo.

## Quick Start

1. Create or edit the raw diagram source file as `docs/assets/<diagram-name>.mmd`.
2. Apply standard semantic color classes via `classDef` at the top of the file:
   ```mermaid
   flowchart TD
       classDef user fill:#f0f9ff,stroke:#0284c7,stroke-width:2px,color:#0369a1;
       classDef app fill:#eef2ff,stroke:#6366f1,stroke-width:2px,color:#312e81;
       classDef api fill:#ecfdf5,stroke:#10b981,stroke-width:2px,color:#064e3b;
       classDef db fill:#fffbeb,stroke:#f59e0b,stroke-width:2px,color:#78350f;
       classDef auth fill:#fff1f2,stroke:#f43f5e,stroke-width:2px,color:#881337;
       classDef ext fill:#faf5ff,stroke:#a855f7,stroke-width:2px,color:#581c87;

       U["Public Visitor"]:::user --> W["Next.js Web"]:::app
       W --> API["API server"]:::api
       API --> DB[("PostgreSQL")]:::db
   ```
3. Render the diagram to 2x crisp PNG using the project script:
   ```sh
   NOTE: no render pipeline in this repo — hand off the .mmd to the owner or run a mermaid CLI locally if one is installed
   ```
4. Embed the rendered PNG in the markdown file (`![Diagram Title](../assets/<diagram-name>.png)`). **Never duplicate raw `mermaid ` code blocks in markdown files where the image is already embedded.**

## Visual Hierarchy & Styling Rules

- **Semantic Color Palette**:
  - `user`: Sky (`#f0f9ff`, border `#0284c7`) for visitors, editors, admins.
  - `app`: Indigo (`#eef2ff`, border `#6366f1`) for Next.js web & admin apps.
  - `api`: Emerald (`#ecfdf5`, border `#10b981`) for backend services, APIs, controllers.
  - `db`: Amber (`#fffbeb`, border `#f59e0b`) for relational databases and object storage.
  - `auth`: Rose (`#fff1f2`, border `#f43f5e`) for identity providers, sessions, JWT guards.
  - `ext`: Purple (`#faf5ff`, border `#a855f7`) for external sibling platforms and third-party services.
- **Node Budget**: Keep diagrams under 15 nodes. If more detail is needed, split into an overview diagram and focused domain diagrams.
- **Consistent Direction**: Stick strictly to one layout direction (`TD` for tiered architectures, `LR` for pipelines and state machines). Never mix directions.
- **Subgraphs**: Always wrap related components in descriptive subgraphs with spaced quoted headers (e.g. `subgraph Apps [" Applications "]`).
- **High Contrast Only**: Always pair light pastel backgrounds with deep saturated 2px borders and dark text (`#0f172a` or deep palette shade). Never use dark backgrounds that swallow text.

## File Organization & Lifecycle

```plain text
docs/
├── assets/
│   ├── <name>.mmd            # Raw diagram source (single source of truth)
│   ├── <name>.png            # Rendered 2x high-resolution PNG
│   ├── render.sh             # Automated rendering script
│   └── mermaid.config.json   # Base theme typography and geometry settings
└── <domain>/<doc>.md         # Markdown documentation referencing ![Title](../assets/<name>.png)
```

## Detailed Guidelines & Templates

See [REFERENCE.md](REFERENCE.md) for complete copy-paste templates, Sequence diagram standards, ERD guidelines, and full color specifications.
