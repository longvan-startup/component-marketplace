import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

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
