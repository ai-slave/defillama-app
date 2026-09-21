#!/usr/bin/env node
//
// Runs a TypeScript command under Node with the repo's `~/` path aliases.
// Temporary launcher while the deploy build runs on Node instead of Bun.

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import nextEnv from '@next/env'
import { createJiti } from 'jiti'

const commandDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(commandDir, '..', '..')
const [scriptPath, ...scriptArgs] = process.argv.slice(2)

if (!scriptPath) {
	console.error('Usage: node ./scripts/command/runTsCommand.mjs <script> [...args]')
	process.exit(1)
}

process.chdir(repoRoot)
// Bun auto-loads .env files before module evaluation; Node does not. The command
// scripts read env-derived constants at import time, so load env before importing.
const { loadEnvConfig, updateInitialEnv } = nextEnv
const originalNodeEnv = process.env.NODE_ENV
updateInitialEnv({ NODE_ENV: originalNodeEnv })
loadEnvConfig(repoRoot, originalNodeEnv !== 'production' && originalNodeEnv !== 'test')
if (originalNodeEnv === undefined) delete process.env.NODE_ENV
else process.env.NODE_ENV = originalNodeEnv
process.argv = [process.argv[0], path.resolve(repoRoot, scriptPath), ...scriptArgs]
process.env.JITI_JSX ??= '1'
process.env.JITI_ALIAS ??= JSON.stringify({
	'~/public': path.join(repoRoot, 'public'),
	'~/public/*': path.join(repoRoot, 'public', '*'),
	'~': path.join(repoRoot, 'src'),
	'~/*': path.join(repoRoot, 'src', '*')
})

const jiti = createJiti(repoRoot)
await jiti.import(jiti.resolve(path.resolve(repoRoot, scriptPath))).catch((error) => {
	console.error(error)
	process.exit(1)
})
