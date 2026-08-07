import { promises as fs } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Mirrors src/utils/metadata/__tests__/importBoundary.test.ts for this
// module tree: tablePages mixes browser-safe modules (types.ts,
// tableQuery.ts) with server-only ones, so the `.server.ts` suffix — not the
// directory — is the boundary. Client entry roots must never statically
// import a tablePages `.server` module at runtime.
const CLIENT_ENTRY_ROOTS = ['src/pages', 'src/components', 'src/containers', 'src/hooks']
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx'])
const FORBIDDEN_IMPORT = /~\/server\/tablePages\/[^'"]*\.server/

async function collectSourceFiles(rootDir: string): Promise<string[]> {
	const entries = await fs.readdir(rootDir, { withFileTypes: true })
	const files: string[] = []
	for (const entry of entries) {
		const filePath = path.join(rootDir, entry.name)
		if (entry.isDirectory()) {
			if (entry.name === '__tests__') continue
			files.push(...(await collectSourceFiles(filePath)))
			continue
		}
		if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) files.push(filePath)
	}
	return files
}

function runtimeImportSpecifiers(source: string): string[] {
	const specifiers: string[] = []
	for (const match of source.matchAll(/^import\s+(?!type\b)[^'"]*['"]([^'"]+)['"]/gm)) {
		if (match[1]) specifiers.push(match[1])
	}
	return specifiers
}

describe('tablePages import boundary', () => {
	// Walks every client-root source file; give it headroom under parallel load.
	it('keeps .server modules out of client entry roots', { timeout: 30_000 }, async () => {
		const offenders: string[] = []
		for (const root of CLIENT_ENTRY_ROOTS) {
			for (const file of await collectSourceFiles(path.resolve(process.cwd(), root))) {
				// Server-side files inside containers (.server suffix, server/ dirs,
				// pages/api routes) are legitimate importers of kernel .server modules.
				const relative = path.relative(process.cwd(), file)
				if (
					/\.server\.tsx?$/.test(relative) ||
					/(^|\/)server\//.test(relative) ||
					relative.startsWith('src/pages/api/')
				) {
					continue
				}
				const source = await fs.readFile(file, 'utf8')
				if (runtimeImportSpecifiers(source).some((specifier) => FORBIDDEN_IMPORT.test(specifier))) {
					offenders.push(path.relative(process.cwd(), file))
				}
			}
		}
		expect(offenders).toEqual([])
	})
})
