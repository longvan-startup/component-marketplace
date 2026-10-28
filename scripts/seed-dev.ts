/**
 * seed-dev.ts — idempotent development seed cho Catalog (issue #60).
 *
 * Mục tiêu: `GET /components` có dữ liệu thật từ PostgreSQL khi dev local,
 * để #32/#56 (web live wiring) không phải nhìn list rỗng.
 *
 * Đặc điểm:
 *   - UPSERT theo unique slug (`onConflictDoUpdate`) → chạy lại KHÔNG tạo
 *     duplicate, KHÔNG xóa dữ liệu ngoài scope, id/createdAt giữ nguyên,
 *     chỉ đồng bộ các field seed-known (name/description/category/tags/
 *     latestVersion/isPublished/updatedAt).
 *   - Chỉ dùng cột có sẵn trong schema hiện hành — KHÔNG cột `summary`
 *     (issue #41 chốt Option A: mapper derive server-side, không migration).
 *   - KHÔNG tạo user giả (auth #17 chưa ship): mọi row `authorId = null`
 *     → DTO `author` của mapper = 'anonymous' (fallback đã test ở #58).
 *   - Có fixture `description = null` (seed-legacy-tool) để demo fallback.
 *   - KHÔNG wire vào CI/CD, Docker, migrations — dev convenience only.
 *
 * Safety guards (theo SAFETY của #60):
 *   1. `DATABASE_URL` chưa set → IN "SKIPPED", exit 0, không mở connection
 *      (bun tự load `.env` khi chạy từ repo root).
 *   2. `NODE_ENV=production` → REFUSE, exit 1 (seed chỉ dành cho dev).
 *   3. Mặc định CHỈ cho phép DB local (localhost/127.0.0.1/::1); host khác
 *      (remote/Neon) phải set `SEED_ALLOW_REMOTE=1` explicitly — không tự ý
 *      chạy trên remote database.
 *   4. Không DELETE/TRUNCATE/reset migrations — chỉ upsert theo slug.
 *
 * Client PostgreSQL luôn đóng trong `finally` — cùng pattern graceful
 * shutdown của #29 (`createDbHandle().close()`).
 */

import { createDbHandle, schema } from '@marketplace/db'

/** Table path qua `schema` — điểm re-export duy nhất của `@marketplace/db`. */
const components = schema.components

/**
 * Kiểu seed lấy từ schema (`$inferInsert`) — KHÔNG import drizzle-orm trực
 * tiếp tại đây: root scripts chỉ được phụ thuộc workspace packages
 * (boundary CI), `drizzle-orm` là dependency của `@marketplace/db`.
 */
type ComponentSeed = typeof components.$inferInsert

/** Host được coi là "DB local mặc định" (SAFETY #3). */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

/** 8 published — phủ đủ 3 category của hợp đồng (#31): animation, react-component, tool. */
const PUBLISHED_SEEDS: ComponentSeed[] = [
  {
    slug: 'seed-hero-section',
    name: 'Seed Hero Section',
    description:
      'Responsive hero section with layered title, subtitle and CTA. Layout keeps spacing stable from mobile to desktop and exposes slots for typed children so product teams can drop content in without style overrides.',
    category: 'react-component',
    tags: ['hero', 'landing', 'responsive'],
    latestVersion: '1.2.0',
    isPublished: true,
  },
  {
    slug: 'seed-stack-navigator',
    name: 'Seed Stack Navigator',
    description:
      'Client-side stack navigator with typed route params, back-stack persistence and optional transition presets. Built on the existing design tokens; no extra router dependency for the MVP.',
    category: 'react-component',
    tags: ['navigation', 'router', 'client-island'],
    latestVersion: '2.1.0',
    isPublished: true,
  },
  {
    slug: 'seed-form-validator',
    name: 'Seed Form Validator',
    description:
      'Progressive form validation hooks with field-level messages, submit gating and async rule support. Works with plain forms — the marketplace admin uses it for component metadata editing.',
    category: 'react-component',
    tags: ['form', 'validation', 'hooks'],
    latestVersion: '1.4.0',
    isPublished: true,
  },
  {
    slug: 'seed-spring-cards',
    name: 'Seed Spring Cards',
    description:
      'Card grid entrances driven by spring physics: staggered rise, hover lift and press feedback. Honors prefers-reduced-motion and degrades to static layout, matching the GSAP island conventions of apps/web.',
    category: 'animation',
    tags: ['gsap', 'cards', 'spring', 'micro-interaction'],
    latestVersion: '0.9.1',
    isPublished: true,
  },
  {
    slug: 'seed-motion-timeline',
    name: 'Seed Motion Timeline',
    description:
      'Declarative scroll timeline for section-by-section reveals. Registered on data attributes only, so content owners compose sequences without touching animation code.',
    category: 'animation',
    tags: ['gsap', 'timeline', 'scroll'],
    latestVersion: '1.0.0',
    isPublished: true,
  },
  {
    slug: 'seed-cli-scaffold',
    name: 'Seed CLI Scaffold',
    description:
      'Interactive scaffold command that stamps a new marketplace component: folder layout, contract test stub and README skeleton, aligned with docs/ENGINEERING.md conventions.',
    category: 'tool',
    tags: ['cli', 'devtools', 'scaffold'],
    latestVersion: '0.5.0',
    isPublished: true,
  },
  {
    slug: 'seed-image-optimizer',
    name: 'Seed Image Optimizer',
    description:
      'Batch image pipeline that emits multiple sizes and a manifest for next/image usage. Keeps compression settings in one config file so previews and production match.',
    category: 'tool',
    tags: ['images', 'performance', 'build-tool'],
    latestVersion: '1.1.3',
    isPublished: true,
  },
]

/**
 * Fixture `description = null` + `authorId = null` — dùng để check mapper
 * fallback của #58 (description & summary rơi về `name`, author = 'anonymous').
 */
const NULL_DESCRIPTION_SEED: ComponentSeed = {
  slug: 'seed-legacy-tool',
  name: 'Seed Legacy Tool',
  // description: null — cố ý (contract min(1) qua mapper fallback = name).
  description: null,
  category: 'tool',
  tags: ['legacy'],
  latestVersion: '0.2.0',
  isPublished: true,
}

/** 2 drafts — chứng minh 404 ở detail + không đếm vào danh sách công khai. */
const DRAFT_SEEDS: ComponentSeed[] = [
  {
    slug: 'seed-draft-animation',
    name: 'Seed Draft Animation',
    description:
      'Internal draft: parallax scroller under active development. THIS ROW IS NOT PUBLISHED.',
    category: 'animation',
    tags: ['draft'],
    latestVersion: '0.0.1',
    isPublished: false,
  },
  {
    slug: 'seed-draft-pipeline',
    name: 'Seed Draft Pipeline',
    description:
      'Internal draft: deploy pipeline helper, not reviewed yet. THIS ROW IS NOT PUBLISHED.',
    category: 'tool',
    tags: ['draft'],
    latestVersion: '0.0.1',
    isPublished: false,
  },
]

/** Mọi row đều không gắn author — auth #17 chưa ship (SAFETY: no fake users). */
function withNullAuthor(seed: ComponentSeed): ComponentSeed {
  return { ...seed, authorId: null }
}

export const ALL_SEEDS: ComponentSeed[] = [
  ...PUBLISHED_SEEDS.map(withNullAuthor),
  withNullAuthor(NULL_DESCRIPTION_SEED),
  ...DRAFT_SEEDS.map(withNullAuthor),
]

/* ------------------------------------------------------------------ */
/* Guards                                                              */
/* ------------------------------------------------------------------ */

type Guard =
  | { kind: 'missing' }
  | { kind: 'ok'; url: string; host: string }
  | { kind: 'refused'; reason: 'NODE_ENV=production; dev seed must never run against production.' }
  | { kind: 'refused'; reason: string; host: string }

function guardDatabaseUrl(raw: string | undefined): Guard {
  if (raw === undefined || raw.trim() === '') return { kind: 'missing' }
  let host: string
  try {
    host = new URL(raw).hostname
  } catch {
    return {
      kind: 'refused',
      reason: 'DATABASE_URL is set but not a parseable PostgreSQL URL.',
      host: '(unparseable)',
    }
  }
  if (process.env.NODE_ENV === 'production') {
    return {
      kind: 'refused',
      reason: 'NODE_ENV=production; dev seed must never run against production.',
      host,
    }
  }
  if (!LOCAL_HOSTS.has(host) && process.env.SEED_ALLOW_REMOTE !== '1') {
    return {
      kind: 'refused',
      reason:
        'DATABASE_URL host is not local; remote databases are never seeded automatically (set SEED_ALLOW_REMOTE=1 to override explicitly).',
      host,
    }
  }
  return { kind: 'ok', url: raw, host }
}

/* ------------------------------------------------------------------ */
/* Runner                                                              */
/* ------------------------------------------------------------------ */

async function run(): Promise<number> {
  const guard = guardDatabaseUrl(process.env.DATABASE_URL)
  if (guard.kind === 'missing') {
    console.log('[seed-dev] SKIPPED — DATABASE_URL is not set; no data written.')
    console.log(
      '[seed-dev] Hints: `docker compose up -d postgres` + `bun run db:migrate`, then re-run.',
    )
    return 0
  }
  if (guard.kind === 'refused') {
    console.error(`[seed-dev] REFUSED — ${guard.reason} (host: ${guard.host})`)
    return 1
  }

  const handle = createDbHandle(guard.url, { connectTimeout: 5 })
  try {
    for (const seed of ALL_SEEDS) {
      await handle.db
        .insert(components)
        .values(seed)
        .onConflictDoUpdate({
          // unique index `components_slug_unique` (schema.ts) — deterministic
          // slug là cờ upsert: chạy lại đồng bộ field seed-known, KHÔNG đụng
          // id/createdAt (chỉ updatedAt refresh theo lượt chạy mới nhất).
          target: components.slug,
          set: {
            name: seed.name,
            description: seed.description,
            category: seed.category,
            tags: seed.tags,
            latestVersion: seed.latestVersion,
            isPublished: seed.isPublished,
            updatedAt: new Date(),
          },
        })
    }

    // Đếm trong JS trên SELECT nhỏ — tránh import drizzle helpers (boundary):
    // đây chỉ là log dev; endpoint thật mới là nơi kiểm tra (query.ts).
    const rows = await handle.db
      .select({ slug: components.slug, isPublished: components.isPublished })
      .from(components)
    const seen = rows.filter((row) => row.slug.startsWith('seed-'))
    const seededPublished = seen.filter((row) => row.isPublished).length
    const seededDrafts = seen.length - seededPublished
    console.log(
      `[seed-dev] OK — upserted ${ALL_SEEDS.length}/${ALL_SEEDS.length} rows by unique slug.`,
    )
    console.log(`[seed-dev] Counts: published=${seededPublished}, drafts=${seededDrafts}.`)
    return 0
  } finally {
    await handle.close({ timeout: 5 })
  }
}

process.exitCode = await run()
