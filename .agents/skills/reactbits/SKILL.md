---
name: reactbits
description: Use only when the task names React Bits. Not the web animation stack. Web motion uses GSAP through apps/web. Do not load for a static control.
source: https://www.reactbits.dev/get-started/introduction
---

# React Bits

Load this only when the task names React Bits. `apps/web` already uses Tailwind v4 and GSAP (`lib/gsap.ts`, `useGsapScope`). Those rules in `apps/web/AGENTS.md` stay in force.

Do not add shadcn/ui, `components.json`, framer-motion, or a second animation stack. Do not run a shadcn or React Bits CLI install.

React Bits components ship their own motion. Pasting one in does not go through GSAP. That conflicts with the approved animation stack. If the task names a React Bits component, say that trade-off and stop. Do not bypass `apps/web/AGENTS.md` to install it. A later task can approve an exception. This skill does not.
