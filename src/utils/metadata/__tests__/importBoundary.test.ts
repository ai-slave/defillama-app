import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { collectSourceFiles } from '../../../../scripts/lib/sourceFiles'

// Client entries may only reach server metadata and dataset readers through a
// dynamic import inside a page data function. This walks static runtime imports
// from every client entry, so it catches both a direct import and one reached
// through a chain of client-side intermediate modules. It is not an oxlint rule
// because no-restricted-imports also flags the sanctioned dynamic import().
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx']
const CLIENT_ENTRY_ROOTS = ['src/pages', 'src/components', 'src/containers']

function toPosixRelative(filePath: string): string {
	return path.relative(process.cwd(), filePath).split(path.sep).join('/')
}

function getStaticImportStatements(source: string): Array<string> {
	const statements: Array<string> = []
	let statement: string | null = null

	for (const line of source.split('\n')) {
		const trimmed = line.trim()
		if (!statement && !/^import\b/.test(trimmed)) continue

		statement = statement ? `${statement}\n${line}` : line

		if (/\sfrom\s+['"][^'"]+['"]/.test(statement) || /^import\s+['"][^'"]+['"]/.test(statement.trim())) {
			statements.push(statement)
			statement = null
		}
	}

	return statements
}

function getStaticRuntimeImportSpecifiers(source: string): Array<string> {
	const specifiers: Array<string> = []

	for (const statement of getStaticImportStatements(source)) {
		if (/^\s*import\s+type\b/.test(statement)) continue

		const match = statement.match(/\sfrom\s+['"]([^'"]+)['"]/) ?? statement.match(/^\s*import\s+['"]([^'"]+)['"]/)
		if (match?.[1]) specifiers.push(match[1])
	}

	return specifiers
}

// Domain server modules (including nested data/server folders) are server-only and may
// statically import dataset readers; the boundary guards page/client code.
function isContainerServerModule(relativePath: string): boolean {
	return /^src\/containers\/[^/]+\/(?:.*\/)?server\//.test(relativePath)
}

// Server-side files inside client roots (API routes, server/ dirs, .server files, tests)
// are legitimate importers of server-only modules and are not client entries.
function isClientEntry(relativePath: string): boolean {
	if (relativePath.startsWith('src/pages/api/')) return false
	if (relativePath.includes('/__tests__/')) return false
	if (/\.(server|test|spec)\.[jt]sx?$/.test(relativePath)) return false
	if (isContainerServerModule(relativePath)) return false
	return CLIENT_ENTRY_ROOTS.some((root) => relativePath.startsWith(`${root}/`))
}

// Server-side modules (API routes, server/ dirs, .server files) may import readers
// directly, so a chain that passes through one is not a client leak. The walk
// still reports them as a direct target of a client module; it just stops there.
function isServerSideModule(relativePath: string): boolean {
	return (
		relativePath.startsWith('src/pages/api/') ||
		/(?:^|\/)server\//.test(relativePath) ||
		/\.server\.[jt]sx?$/.test(relativePath)
	)
}

function isServerOnlyModule(relativePath: string): boolean {
	return (
		relativePath === 'src/utils/metadata/index.ts' ||
		relativePath === 'src/utils/metadata/index.tsx' ||
		relativePath.startsWith('src/server/datasetSnapshots/') ||
		relativePath.startsWith('src/server/routeRegistry/') ||
		/^src\/containers\/[^/]+\/server\/.*\.cache\.(ts|tsx|js|jsx)$/.test(relativePath)
	)
}

function resolveInternalSpecifier(fromFile: string, specifier: string): string | null {
	let basePath: string
	if (specifier.startsWith('~/')) {
		basePath = path.join(process.cwd(), 'src', specifier.slice(2))
	} else if (specifier.startsWith('.')) {
		basePath = path.resolve(path.dirname(fromFile), specifier)
	} else {
		return null
	}

	for (const candidate of [
		basePath,
		`${basePath}.ts`,
		`${basePath}.tsx`,
		`${basePath}.js`,
		`${basePath}.jsx`,
		path.join(basePath, 'index.ts'),
		path.join(basePath, 'index.tsx'),
		path.join(basePath, 'index.js'),
		path.join(basePath, 'index.jsx')
	]) {
		if (SOURCE_EXTENSIONS.includes(path.extname(candidate)) && existsSync(candidate)) return candidate
	}

	return null
}

describe('metadata artifact import boundary', () => {
	test('keeps server metadata and dataset readers out of transitive client runtime imports', () => {
		const errors: Array<string> = []
		const sourceByFile = new Map<string, string>()
		for (const filePath of collectSourceFiles(path.join(process.cwd(), 'src'), SOURCE_EXTENSIONS)) {
			sourceByFile.set(filePath, readFileSync(filePath, 'utf8'))
		}

		const visited = new Set<string>()

		function visit(filePath: string, stack: Array<string>) {
			if (visited.has(filePath)) return
			visited.add(filePath)

			const source = sourceByFile.get(filePath)
			if (!source) return

			for (const specifier of getStaticRuntimeImportSpecifiers(source)) {
				const resolved = resolveInternalSpecifier(filePath, specifier)
				if (!resolved) continue

				const relativeResolved = toPosixRelative(resolved)
				if (isServerOnlyModule(relativeResolved)) {
					errors.push(`${stack.join(' -> ')} -> ${relativeResolved}`)
					continue
				}

				if (sourceByFile.has(resolved) && !isServerSideModule(relativeResolved)) {
					visit(resolved, [...stack, relativeResolved])
				}
			}
		}

		for (const filePath of sourceByFile.keys()) {
			const relativePath = toPosixRelative(filePath)
			if (isClientEntry(relativePath)) visit(filePath, [relativePath])
		}

		expect(errors).toEqual([])
	}, 15_000)
})
