import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

const build = spawnSync(
  'bun',
  [
    'build',
    './src/index.ts',
    '--outfile=dist/index.js',
    '--target=node',
    '--format=cjs',
    '--env=disable',
  ],
  { stdio: 'inherit' },
)

if (build.status !== 0) {
  process.exit(build.status ?? 1)
}

const outfile = 'dist/index.js'
// Vercel copies dist/index.js to /var/task/index.js and loads it as CommonJS.
// The service entry scan also requires this file to mention express.
const source = readFileSync(outfile)
writeFileSync(outfile, Buffer.concat([Buffer.from('// require("express")\n'), source]))

// Docker runs the bundle from dist/, so keep its runtime source tree adjacent.
// Vercel separately includes the repository registry/ tree with includeFiles.
const registrySource = 'registry'
const registryOutput = 'dist/registry'
if (!existsSync(registrySource)) {
  throw new Error(`Missing component registry source directory: ${registrySource}`)
}
rmSync(registryOutput, { recursive: true, force: true })
mkdirSync('dist', { recursive: true })
cpSync(registrySource, registryOutput, { recursive: true })
