/**
 * Tests for scripts/check-boundaries.mjs — boundary enforcement.
 *
 * Positive: rule-compliant imports (shared package, external dep, same domain)
 *           → zero violations.
 * Negative: deliberately bad imports (web→db, api→web, shared→db, reaching into
 *           packages by relative path) → each case must FAIL with the exact
 *           rule and file.
 *
 * Fixtures are built in a tmpdir instead of committing "bad" files into the repo
 * (bad files in the repo would make `bun run boundary` itself FAIL).
 */
import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { collectViolations } from './check-boundaries.mjs'

async function withFixture(files, run) {
  const root = await mkdtemp(join(tmpdir(), 'boundary-fixture-'))
  try {
    for (const [rel, content] of Object.entries(files)) {
      const full = join(root, rel)
      await mkdir(join(full, '..'), { recursive: true })
      await writeFile(full, content)
    }
    return run(collectViolations(root))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

/** Compact fingerprint of a violation list for assertions. */
const fingerprints = (violations) => violations.map((x) => `${x.file} ${x.rule} ${x.spec}`).sort()

describe('check-boundaries', () => {
  test('PASS — rule-compliant imports produce zero violations', async () => {
    await withFixture(
      {
        // Frontend: public API of shared + external deps + same-domain relative file
        'apps/web/app/page.tsx':
          "import { AppInfo } from '@marketplace/shared'\n" +
          "import type { Metadata } from 'next'\n" +
          "import { helper } from '../lib/local'\n",
        'apps/web/lib/local.ts': 'export const helper = 1\n',
        // Backend: shared + db + external — all valid
        'apps/api/src/index.ts':
          "import { getAppInfo } from '@marketplace/shared'\n" +
          "import { db } from '@marketplace/db'\n" +
          "import express from 'express'\n",
        // Shared: zero internal deps — same-package relative import only
        'packages/shared/src/index.ts': "import { util } from './util'\n",
        'packages/shared/src/util.ts': 'export const util = 1\n',
      },
      (violations) => expect(violations).toEqual([]),
    )
  })

  test('FAIL — web imports the DB directly', async () => {
    await withFixture(
      {
        'apps/web/app/page.tsx': "import { db } from '@marketplace/db'\n",
      },
      (violations) => {
        expect(fingerprints(violations)).toEqual([
          'apps/web/app/page.tsx RULE_NO_DIRECT_DEP @marketplace/db',
        ])
      },
    )
  })

  test('FAIL — api imports UI code from apps/web', async () => {
    await withFixture(
      {
        'apps/api/src/ui-dispatch.ts': "import { Button } from '../../web/app/ui'\n",
      },
      (violations) => {
        expect(fingerprints(violations)).toEqual([
          'apps/api/src/ui-dispatch.ts RULE_CROSS_DOMAIN ../../web/app/ui',
        ])
      },
    )
  })

  test('FAIL — shared depends on the DB (zero-internal-dep violation)', async () => {
    await withFixture(
      {
        'packages/shared/src/contract.ts': "import { users } from '@marketplace/db'\n",
      },
      (violations) => {
        expect(fingerprints(violations)).toEqual([
          'packages/shared/src/contract.ts RULE_NO_DIRECT_DEP @marketplace/db',
        ])
      },
    )
  })

  test('FAIL — app reaches into packages by relative path instead of the public API', async () => {
    await withFixture(
      {
        'apps/web/app/page.tsx': "import { x } from '../../packages/shared/src/index'\n",
      },
      (violations) => {
        expect(violations).toHaveLength(1)
        expect(violations[0].rule).toBe('RULE_IMPORT_PUBLIC_API_ONLY')
        expect(violations[0].file).toBe('apps/web/app/page.tsx')
      },
    )
  })

  test('FAIL — api imports @marketplace/web (not in the allow-list)', async () => {
    await withFixture(
      {
        'apps/api/src/index.ts': "import { w } from '@marketplace/web'\n",
      },
      (violations) => {
        expect(violations).toHaveLength(1)
        expect(violations[0].rule).toBe('RULE_NO_DIRECT_DEP')
      },
    )
  })

  test("FAIL — web imports code from apps/api path (or any other domain's source)", async () => {
    await withFixture(
      {
        'apps/web/app/page.tsx': "import { config } from '../../api/src/config'\n",
      },
      (violations) => {
        expect(violations[0].rule).toBe('RULE_CROSS_DOMAIN')
        expect(violations[0].file).toBe('apps/web/app/page.tsx')
      },
    )
  })

  test('report contains file + spec + rule + fix hint', async () => {
    await withFixture(
      {
        'apps/web/app/page.tsx': "import { db } from '@marketplace/db'\n",
      },
      (violations) => {
        const v = violations[0]
        expect(v.file).toBe('apps/web/app/page.tsx')
        expect(v.spec).toBe('@marketplace/db')
        expect(v.why).toContain('public HTTP API')
        expect(typeof v.fix).toBe('string')
      },
    )
  })
})
