---
name: reactbits
description: Animated, interactive React UI components and micro-interactions from React Bits (reactbits.dev) — text animations, backgrounds, and polished components in JS/TS + CSS/Tailwind variants.
source: https://www.reactbits.dev/get-started/introduction
---

# React Bits

React Bits (`reactbits.dev`, github.com/DavidHDev/react-bits) is an open-source collection of 200+ animated, interactive, fully customizable React components and micro-interactions: text animations, backgrounds, UI components, and micro interactions. Use it when a surface needs a distinctive animated element (hero background, text reveal, scroll effect, interactive card) rather than hand-rolling one from scratch.

- **4 variants per component**: JS-CSS, JS-TW, TS-CSS, TS-TW. In this repo (`apps/web` is Next.js 16 + React 19 + TypeScript; Tailwind is not installed yet), prefer the **TS-TW** variant only if the task explicitly sets up Tailwind 4; otherwise use the **TS-CSS** variant.
- **Minimal dependencies**, tree-shakeable, copy-paste or CLI-installed — components land as source in the project, not as an opaque npm dependency.
- **License**: MIT + Commons Clause — free for personal and commercial use in a project; the Commons Clause only restricts reselling React Bits itself as a competing product/service.
- Categories: 💬 Text Animations · 🌀 Animations · 🧩 Components · ⚡ Micro interactions · 🖼️ Backgrounds. Free creative tools also exist at reactbits.dev/tools (Background Studio, Shape Magic, Texture Lab) for exporting custom animated backgrounds/shapes/textures as code, SVG, image, or video.

## Check for the React Bits MCP first

A `react_bits` MCP may or may not be mounted in the current session (device routes under `xd://mcp__react_bits_*`, tools like `search_items_in_registries`, `list_items_in_registries`, `view_items_in_registries`, `get_item_examples_from_registries`, `get_add_command_for_items`, `get_project_registries`, `get_audit_checklist`).

- **If those `mcp__react_bits_*` tools are available**: use them (workflow below). They query a `components.json` `registries` block, so they only work once the project has one.
- **If they are not available, or `get_project_registries` errors because no `components.json` exists yet**: do not try to bootstrap MCP-only tooling (e.g. `init_project`) just to use this skill. Fall back to the plain CLI/manual workflow (below) — it needs no MCP.

### MCP workflow (when available)

1. `get_project_registries` — confirm `@react-bits` (or the project's configured alias) is present in `components.json`. Errors here mean no `components.json`; stop and use the manual workflow instead of creating one purely for this lookup.
2. `search_items_in_registries` (`query`, optional `registries`/`types`/`limit`/`offset`) — fuzzy-find a component by name or description before writing custom UI.
3. `view_items_in_registries` (`items: ["@react-bits/<Name>"]`) — inspect the component's files/props before installing.
4. `get_item_examples_from_registries` (`query: "<Name>-demo"` or `"<Name> example"`) — pull a working usage example with its full code and dependencies.
5. `get_add_command_for_items` (`items: ["@react-bits/<Name>-TS-TW"]`) — get the exact shadcn CLI add command; run it with the project's package runner (`bunx --bun shadcn@latest add ...`).
6. `get_audit_checklist` — run once after adding/generating the component to verify nothing was missed.

### Manual workflow (no MCP, or no `components.json`)

1. Browse reactbits.dev by category (Text Animations / Animations / Components / Micro / Backgrounds) or search by name to find the component.
2. Each component page ships copy-ready code for all 4 variants — pick **TS-TW** for this repo.
3. Either copy the source directly into the app's components directory, or install via the shadcn CLI once/if the project adopts `components.json`:

   ```bash
   bunx --bun shadcn@latest add @react-bits/BlurText-TS-TW
   ```

   This requires a `components.json` with the React Bits registry mapped:

   ```json
   {
     "$schema": "https://ui.shadcn.com/schema.json",
     "registries": {
       "@react-bits": "https://reactbits.dev/r/{name}.json"
     }
   }
   ```

4. After adding, read the resulting file(s): check imports resolve against the project's actual path aliases, strip any dependency the project doesn't already use (or add it deliberately), and confirm the component respects `prefers-reduced-motion` before shipping it — React Bits components favor visual flourish, so reduced-motion and performance are the reviewer's job, not the library's.

## Using components well

- Don't reach for a React Bits component just because it exists — use it where `frontend-design`/`emil-design-eng`/`apple-design` guidance in this repo already calls for motion (spatial consistency, feedback, one deliberate hero moment), not as decoration on every section.
- Prefer the smallest variant that does the job; large background/canvas effects (WebGL, particle, shader-based) are expensive — check they don't tank Core Web Vitals on `apps/web`'s public pages, and gate them behind `prefers-reduced-motion`/viewport checks where the component doesn't already do so.
- Treat installed component source as project code from that point on: it follows this repo's JSDoc, lint, and Tailwind-semantic-token conventions like anything else, not the library's own house style.
