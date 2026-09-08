#!/usr/bin/env node

import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const commandDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(commandDir, '..', '..')
const [nodeEnv, nextCommand, ...nextArgs] = process.argv.slice(2)
const isProductionBuild = nodeEnv === 'production' && nextCommand === 'build'
// Turbopack builds hang nondeterministically on Vercel's build machines (see PR #3382); Coolify
// builds Turbopack through the deploy wrapper and are unaffected.
const bundlerArgs = isProductionBuild && process.env.VERCEL && !nextArgs.includes('--webpack') ? ['--webpack'] : []
// V8-only heap flag; Bun (JavaScriptCore) manages its own heap and ignores it.
const buildNodeOptions = process.versions.bun ? '' : '--max-heap-size=6144'

if (!nodeEnv || !nextCommand) {
	console.error('Usage: node ./scripts/command/runPreparedNext.mjs <NODE_ENV> <next-command> [...args]')
	process.exit(1)
}

const env = { ...process.env, NODE_ENV: nodeEnv }

function packageBin(name) {
	return path.join(repoRoot, 'node_modules', '.bin', process.platform === 'win32' ? `${name}.cmd` : name)
}

function packageScript(packageName, ...parts) {
	return path.join(repoRoot, 'node_modules', packageName, ...parts)
}

function run(command, args, envOverrides = {}) {
	return new Promise((resolve) => {
		const child = spawn(command, args, {
			cwd: repoRoot,
			env: { ...env, ...envOverrides },
			shell: process.platform === 'win32' || command.endsWith('.cmd'),
			stdio: 'inherit'
		})
		child.on('error', (error) => {
			console.error(`${command}: ${error.message}`)
			resolve(1)
		})
		child.on('close', (exitCode, signal) => {
			if (signal) {
				resolve(1)
				return
			}
			resolve(exitCode ?? 1)
		})
	})
}

const prepareExitCode = await run('bun', [path.join(repoRoot, 'scripts', 'command', 'prepareCli.ts')])
if (prepareExitCode !== 0) {
	process.exitCode = prepareExitCode
} else {
	if (isProductionBuild) {
		console.log(
			`[build] Starting Next.js production build on ${process.versions.bun ? `Bun ${process.versions.bun}` : `Node ${process.version}`}`
		)
	}
	const nextExitCode = isProductionBuild
		? await run(
				process.execPath,
				[packageScript('next', 'dist', 'bin', 'next'), nextCommand, ...nextArgs, ...bundlerArgs],
				buildNodeOptions ? { NODE_OPTIONS: buildNodeOptions } : {}
			)
		: await run(packageBin('next'), [nextCommand, ...nextArgs])
	if (isProductionBuild && nextExitCode === 0) {
		console.log('[build] Verifying dataset snapshot output boundaries')
		process.exitCode = await run('bun', [path.join(repoRoot, 'scripts', 'verifyDatasetSnapshotBoundaries.ts')])
	} else {
		process.exitCode = nextExitCode
	}
}
