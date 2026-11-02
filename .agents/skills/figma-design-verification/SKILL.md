---
name: figma-design-verification
description: Verify Figma Plugin API changes against real node data (not a screenshot alone) after every mutation, and ask one concrete question before building on an ambiguous instruction. Use for any task that reads or writes the Luva UI Figma file via use_figma/the Plugin API — components, variants, layout, variables, prototyping.
license: MIT
---

# Figma Design Verification

## Overview

The Luva UI Figma file (component-marketplace design work) is maintained by AI agents through the Figma Plugin API (`use_figma`). That API has caching and sync behavior that makes a screenshot, or "it looks right," an unreliable way to judge whether a change actually worked — stale auto-hug sizes, silently clipped content, invisible text from a default fill, instance-override restrictions. Every one of these was hit in the same session on 2026-10-31 and each cost multiple rounds of rework before the real cause was found by reading actual node data instead of trusting a render. This skill exists so that discipline doesn't have to be relearned.

## The core rule: audit real data after every mutation, not a screenshot

Never declare a Figma change "done" from a screenshot alone. After any `use_figma` mutation:

1. Re-read the actual node data you just touched — `fills`, `strokes`, `x`/`y`/`width`/`height`, `cornerRadius`, `clipsContent`, `opacity`, `layoutSizingHorizontal`/`layoutSizingVertical` — via a follow-up `use_figma` read. Don't infer correctness from how the render looks.
2. Also re-read anything structurally adjacent to what you touched: the parent frame's height after a child resized, siblings in the same row, the other half of a split-screen layout. A change in one place routinely breaks something next to it that a screenshot crop won't show.
3. After resizing or repositioning any top-level (page-level) node, run a full-page bounding-box collision check across ALL top-level nodes — not just the one you changed. A single resize cascades into neighbors.
4. Treat a reused/pre-existing component as unverified until you've pulled its real properties. Don't assume a master component is correct just because it's already on the canvas — it may carry a pre-existing bug (invisible text, a stray element) that a cursory look won't surface.

A screenshot is a visual sanity check, not verification. Pull real data before telling the user something is fixed.

## Known Plugin API gotchas — check for these proactively

- **`figma.createAutoLayout()` defaults to an opaque white fill**, same as `createFrame()` — not transparent. Causes invisible white-on-white (or white-on-dark) text and stray white corners poking past rounded clips. Always explicitly set `fills = []` on a wrapper unless a background fill is actually wanted.
- **Stale auto-hug cache**: after reparenting or resizing a child, a parent with `primaryAxisSizingMode`/`counterAxisSizingMode: 'AUTO'` can report a stale cached `height`/`width` instead of the recomputed value. Don't trust the reported number — explicitly `resize()` the parent to `max(child.y + child.height) + padding` (or the width equivalent) after any structural change.
- **Row overflow silently clips the last child's corner**: a `layoutSizingHorizontal: 'FILL'` row whose children's combined natural width exceeds the row's filled width will, with `clipsContent: true`, clip the overflow off the LAST child — including its rounded corner. This looks exactly like a missing-`cornerRadius` bug but isn't one. Fix: let the row `HUG` its true content width and resize the parent to match; don't force `FILL` to a precomputed width when a sibling's content (e.g. a longer label) can grow past it.
- **Instance override restriction**: you cannot `resize()` or set `x`/`y` on a vector/node nested inside a placed `INSTANCE` in many cases — it throws `This property cannot be overridden in an instance: relative-transform`. Fix the issue on the MASTER component only, then delete and recreate each placed instance fresh from the corrected master, rewiring any prototype reactions afterward. Don't keep fighting the instance directly.
- `layoutSizingHorizontal`/`layoutSizingVertical` (`'FIXED'|'HUG'|'FILL'`, set on a child) and `primaryAxisSizingMode`/`counterAxisSizingMode` (`'FIXED'|'AUTO'`, set on the frame itself) are different enums — don't cross them.
- `setBoundVariableForPaint` returns a NEW paint object — capture and reassign; it does not mutate the existing paint in place.

## Process rule: ask before guessing on ambiguous, high-cost instructions

If an instruction could reasonably mean two or more different things, and building the wrong one would cost multiple rounds of rework (not a trivial fix), ask one concrete clarifying question before building — ideally framed with the visual options, not abstract wording (`AskUserQuestion` with option previews when available). Don't build-then-correct when a single question up front would have resolved it.

Once an instruction unambiguously reverses a prior decision (e.g. "split this back into two separate buttons"), apply it directly — don't re-litigate or re-ask something already stated plainly.

## Canvas organization convention (Luva UI file specifically)

Keep dedicated x-zones so new work never collides with existing screens or components:

- Screens: `x = 1600+`, 1440px wide, 160px vertical gaps between top-level frames.
- Reusable components (staging): `x = 0`.
- Reference/documentation (design tokens, annotations, demos): `x = 3200+` — its own zone, never shared with the other two columns.

## Related

Session memory (outside this repo) carries live, file-specific Figma findings as they come up; this skill carries the durable, repo-level rules that apply regardless of which session or agent is doing the work.
