#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const usage = 'Usage: bun scripts/strict-folder-check.mjs <production|test> <folder>'
const targets = {
	production: 'tsconfig.strict.json',
	test: 'tsconfig.vitest.strict.json'
}
const [targetArg, folderArg, ...extraArgs] = process.argv.slice(2)

if (!targetArg || !folderArg || extraArgs.length > 0 || !Object.hasOwn(targets, targetArg)) {
	console.error(usage)
	process.exit(1)
}

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const folderPath = path.resolve(repositoryRoot, folderArg.replaceAll('\\', path.sep))
const relativeFolder = path.relative(repositoryRoot, folderPath)

if (relativeFolder === '..' || relativeFolder.startsWith(`..${path.sep}`) || path.isAbsolute(relativeFolder)) {
	console.error('Folder must be inside the repository.')
	process.exit(1)
}

if (!fs.statSync(folderPath, { throwIfNoEntry: false })?.isDirectory()) {
	console.error(`Folder does not exist or is not a directory: ${folderArg}`)
	process.exit(1)
}

const displayFolder = relativeFolder.replaceAll(path.sep, '/') || '.'
const tsgoPath = path.join(repositoryRoot, 'node_modules', '@typescript', 'native-preview', 'bin', 'tsgo')
const run = spawnSync(process.execPath, [tsgoPath, '-p', targets[targetArg], '--noEmit', '--pretty', 'false'], {
	cwd: repositoryRoot,
	encoding: 'utf8',
	maxBuffer: 64 * 1024 * 1024,
	stdio: ['ignore', 'pipe', 'pipe']
})

if (run.error || run.status === null || run.signal) {
	console.error(`Strict TypeScript compiler failed to run${run.error ? `: ${run.error.message}` : '.'}`)
	process.exit(1)
}

if (run.stderr?.trim()) {
	console.error('Strict TypeScript compiler wrote unexpected error output.')
	console.error(run.stderr.trim())
	process.exit(1)
}

const output = run.stdout ?? ''
const lines = output.split(/\r?\n/)
const diagnosticPattern = /^(.*)\((\d+),(\d+)\): error TS\d+:/
const globalDiagnosticPattern = /^error TS\d+:/
const sourceExtensionPattern = /\.(?:[cm]?[jt]sx?)$/i

const diagnosticPath = (line) => {
	const match = line.match(diagnosticPattern)
	if (!match) return null

	return path.resolve(repositoryRoot, match[1])
}

const matchesFolder = (line) => {
	const filePath = diagnosticPath(line)
	if (!filePath) return false

	const relativePath = path.relative(folderPath, filePath)
	return relativePath !== '..' && !relativePath.startsWith(`..${path.sep}`) && !path.isAbsolute(relativePath)
}

const folderErrors = lines.filter(matchesFolder)

if (folderErrors.length > 0) {
	console.error(`Strict TypeScript errors in ${displayFolder} (${targetArg}):`)
	console.error(folderErrors.join('\n'))
	process.exit(1)
}

if (run.status === 0) {
	if (output.trim()) {
		console.error('Strict TypeScript compiler produced unexpected output.')
		console.error(output.trim())
		process.exit(1)
	}

	console.log(`Strict TypeScript check passed (${displayFolder}, ${targetArg}).`)
	process.exit(0)
}

const diagnostics = lines.map(diagnosticPath).filter(Boolean)
const fatalDiagnostics = lines.filter((line) => {
	if (globalDiagnosticPattern.test(line)) return true
	const filePath = diagnosticPath(line)
	return filePath !== null && !sourceExtensionPattern.test(filePath)
})

if (diagnostics.length === 0 || fatalDiagnostics.length > 0) {
	console.error(`Strict TypeScript compiler failed (exit ${run.status}).`)
	console.error(fatalDiagnostics.length > 0 ? fatalDiagnostics.join('\n') : output.trim())
	process.exit(1)
}

console.log(
	`No strict errors found in ${displayFolder} (${targetArg}). Ignoring strict errors outside this folder during migration.`
)
process.exit(0)
