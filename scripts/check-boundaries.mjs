/**
 * check-boundaries.mjs — Enforce workspace import boundaries.
 *
 * Rules (docs/ENGINEERING.md → "Knowledge Boundaries"):
 * 1. apps/web MUST NOT import apps/api or packages/db.
 * 2. apps/api MUST NOT import apps/web.
 * 3. packages/shared imports NOTHING from any app; no DB dependency either.
 * 4. Apps may consume internal packages ONLY through their public package
 *    specifier (@marketplace/*), never by reaching into package source folders
 *    with relative paths.
 *
 * Run: bun run boundary   (defined in package.json)
 * Output prints the file, the violating specifier, the rule code, and a fix hint.
 * No new dependencies: node:fs + node:path only.
 */

import { readdirSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Directories skipped while scanning. */
const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.next',
  'dist',
  'build',
  'coverage',
  '.turbo',
  'drizzle',
])

const CODE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])

/**
 * Valid domains — key is the workspace directory.
 * - allowedInternal: internal packages this domain MAY import.
 * - Frontend talks to the backend only via the public HTTP API ⇒ no @marketplace/db.
 * - Backend may use @marketplace/db + @marketplace/shared.
 * - Shared is the stop point: zero internal deps (the shared contract of both sides).
 */
const DOMAINS = {
  'apps/web': {
    label: 'Frontend (apps/web)',
    allowedInternal: ['@marketplace/shared'],
    packageHint:
      'Frontend talks to the Backend only via its public HTTP API — never import the DB directly.',
  },
  'apps/api': {
    label: 'Backend (apps/api)',
    allowedInternal: ['@marketplace/shared', '@marketplace/db'],
    packageHint: 'Backend must not import UI code; public DTOs belong in @marketplace/shared.',
  },
  'packages/shared': {
    label: 'Shared contract (packages/shared)',
    allowedInternal: [],
    packageHint:
      'Shared must stay fully independent (zero internal deps) — it is the shared contract of both sides.',
  },
}

/** Name of the domain containing a path (matched by directory prefix). */
function domainOf(path) {
  for (const key of Object.keys(DOMAINS)) {
    if (path === key || path.startsWith(`${key}/`)) return key
  }
  return null
}

/** Internal package name matching a path in packages/ (e.g. "packages/db"). */
const INTERNAL_PKGS = {
  'packages/shared': '@marketplace/shared',
  'packages/db': '@marketplace/db',
}

function collectFiles(rootDir, dir = '', out = []) {
  const abs = dir ? join(rootDir, dir) : rootDir
  for (const entry of readdirSync(abs)) {
    if (EXCLUDED_DIRS.has(entry)) continue
    const rel = dir ? `${dir}/${entry}` : entry
    const full = join(rootDir, rel)
    if (statSync(full).isDirectory()) {
      collectFiles(rootDir, rel, out)
    } else if (CODE_EXTS.has(entry.slice(entry.lastIndexOf('.')))) {
      out.push(rel)
    }
  }
  return out
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
}

/** Collect every import specifier used in a file (import/export/require/dynamic). */
function extractSpecifiers(source) {
  const specs = []
  const patterns = [
    /\bfrom\s+['"]([^'"]+?)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+?)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+?)['"]\s*\)/g,
    /\bimport\s+['"]([^'"]+?)['"]/g,
  ]
  for (const re of patterns) {
    collectMatches(re, source, specs)
  }
  return specs
}

function collectMatches(re, source, specs) {
  re.lastIndex = 0
  for (;;) {
    const m = re.exec(source)
    if (m === null) break
    specs.push(m[1])
  }
}

/**
 * Classify a specifier:
 * - { kind: 'external' }           → external dependency (or builtin) — allowed.
 * - { kind: 'internal-pkg', name } → import through an internal package specifier.
 * - { kind: 'path' }               → path-based import (relative, or apps/…, packages/…).
 */
function classifySpecifier(spec) {
  if (spec.startsWith('@marketplace/')) {
    return { kind: 'internal-pkg', name: spec, spec }
  }
  return { kind: 'path', spec, isRelative: spec.startsWith('.') }
}

/** Normalize a path-based specifier against the importing file's directory. */
function resolveSpecifierPath(relFile, cls) {
  if (cls.isRelative) return normalize(join(dirname(relFile), cls.spec))
  if (cls.spec.startsWith('apps/') || cls.spec.startsWith('packages/')) {
    return normalize(cls.spec)
  }
  return null // external dependency, not a repo path
}

/** Evaluate one specifier of one file; return a violation or null. */
function checkSpecifier(relFile, spec) {
  const sourceDomain = domainOf(relFile)
  if (!sourceDomain) return null // file outside tracked domains
  const domain = DOMAINS[sourceDomain]
  const cls = classifySpecifier(spec)

  if (cls.kind === 'internal-pkg') {
    if (!domain.allowedInternal.includes(cls.name)) {
      return {
        rule: 'RULE_NO_DIRECT_DEP',
        spec,
        why: `${domain.label} must not depend on internal package "${cls.name}". Allowed: ${domain.allowedInternal.length ? domain.allowedInternal.join(', ') : '(none)'}. ${domain.packageHint}`,
        fix:
          sourceDomain === 'apps/web' && cls.name === '@marketplace/db'
            ? 'Call the public HTTP API (apps/api) instead; never import the DB directly.'
            : `Move what is shared into one of: ${domain.allowedInternal.join(', ') || '(none — requires sign-off from both owners before adding)'}.`,
      }
    }
    return null
  }

  const targetPath = resolveSpecifierPath(relFile, cls)
  if (targetPath === null) return null // external dependency — allowed

  const targetInPackages = targetPath.startsWith('packages/')
  const targetDomain = domainOf(targetPath)

  // App reaching into an internal package by path must go through its public
  // package specifier. Checked against the resolved path AND (because lexical
  // resolution from nested app folders can produce non-existent climbs like
  // "apps/packages/…") against any "packages/<name>" segment mentioning.
  if (
    sourceDomain.startsWith('apps/') &&
    (targetInPackages || /(^|\/)packages\/[\w.-]+/.test(targetPath))
  ) {
    return {
      rule: 'RULE_IMPORT_PUBLIC_API_ONLY',
      spec,
      why: `${domain.label} may consume packages only through their public API (package specifier @marketplace/*), not by importing source files directly.`,
      fix: `Use "${INTERNAL_PKGS[targetDomain] || 'the package specifier'}" instead of a relative path.`,
    }
  }

  if (targetDomain === sourceDomain) {
    // Same-domain import: valid.
    return null
  }

  if (targetDomain === null) {
    // Target escapes every tracked domain (e.g. climbing out of the repo).
    if (targetPath.startsWith('..')) {
      return {
        rule: 'RULE_ESCAPE_PROJECT',
        spec,
        why: `Import escapes the monorepo: "${spec}"`,
        fix: 'Imports must stay inside a repo workspace.',
      }
    }
    return null
  }

  return {
    rule: 'RULE_CROSS_DOMAIN',
    spec,
    why: `${DOMAINS[sourceDomain].label} imports into another domain (${DOMAINS[targetDomain].label}) via "${spec}".`,
    fix:
      sourceDomain === 'apps/web'
        ? 'Frontend talks to the Backend only via the public HTTP API — no cross-source imports.'
        : 'Move shared contracts/types into @marketplace/shared; no cross-source imports.',
  }
}

/**
 * Scan the whole repo and return all violations.
 * @param {string} rootDir repo root
 * @returns {{ file: string, spec: string, rule: string, why: string, fix: string }[]}
 */
export function collectViolations(rootDir) {
  const violations = []
  const files = collectFiles(rootDir)
  for (const relFile of files) {
    const source = readFileSync(join(rootDir, relFile), 'utf8')
    for (const spec of extractSpecifiers(stripComments(source))) {
      const v = checkSpecifier(relFile, spec)
      if (v) violations.push({ file: relFile, ...v })
    }
  }
  return violations
}

function main() {
  const rootDir = process.cwd()
  const violations = collectViolations(rootDir)
  if (violations.length > 0) {
    console.error(`boundary check: FAIL — ${violations.length} violation(s)\n`)
    for (const v of violations) {
      console.error(`${v.file}`)
      console.error(`  ✖ ${v.spec}`)
      console.error(`    rule:   ${v.rule}`)
      console.error(`    reason: ${v.why}`)
      console.error(`    fix:    ${v.fix}\n`)
    }
    process.exit(1)
  }
  console.log('boundary check: PASS — no cross-domain imports.')
}

// Run the CLI only when executed directly (bun scripts/check-boundaries.mjs);
// do not self-run when imported for tests.
function isDirectRun() {
  try {
    const self = realpathSync(fileURLToPath(import.meta.url))
    const entry = process.argv[1] ? realpathSync(process.argv[1]) : ''
    return self === entry
  } catch {
    return false
  }
}
if (isDirectRun()) main()
