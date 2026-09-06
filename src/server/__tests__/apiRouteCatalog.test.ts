import { existsSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, test } from 'vitest'
import { apiRouteCatalog, type ApiRouteCatalogEntry } from '~/server/apiRouteCatalog'
import { collectSourceFiles } from '../../../scripts/lib/sourceFiles'

const pagesApiDir = join(process.cwd(), 'src/pages/api')
const srcDir = join(process.cwd(), 'src')
const apiRouteCatalogFile = join(srcDir, 'server/apiRouteCatalog.ts')
const apiRouteCatalogTestFile = join(srcDir, 'server/__tests__/apiRouteCatalog.test.ts')

function staleReference(...parts: Array<string>) {
	return parts.join('')
}

function routePathFromFile(filePath: string) {
	const relativePath = relative(pagesApiDir, filePath).split(sep).join('/').replace(/\.ts$/, '')
	const [kind, ...routeParts] = relativePath.split('/')
	const routePath = routeParts.join('/').replace(/\/index$/, '')

	return `/api/${kind}/${routePath}`
}

function filePathForEntry(entry: ApiRouteCatalogEntry) {
	const directPath = join(pagesApiDir, entry.kind, `${entry.path}.ts`)
	const indexPath = join(pagesApiDir, entry.kind, entry.path, 'index.ts')

	return existsSync(directPath) ? directPath : indexPath
}

function isProductionSourceFile(filePath: string) {
	if (!/\.(ts|tsx)$/.test(filePath)) return false
	if (filePath === apiRouteCatalogFile) return false
	if (filePath.includes(`${sep}__tests__${sep}`)) return false
	if (/\.(test|spec)\.(ts|tsx)$/.test(filePath)) return false
	return true
}

// /api/collections/ is PocketBase's namespace: those paths are sent through the
// PocketBase client against POCKETBASE_URL, not this app's API routes.
const legacyRelativeApiPathPattern = /['"`](\/api\/(?!public\/|private\/|dynamic\/|collections\/)[^'"`\s)]*)/g

function findLegacyRelativeApiPaths(line: string) {
	const paths: Array<string> = []
	for (const match of line.matchAll(legacyRelativeApiPathPattern)) {
		// A parsed external URL can share the /api namespace without calling this app.
		if (/\.pathname\.startsWith\(\s*$/.test(line.slice(0, match.index))) continue
		paths.push(match[1])
	}
	return paths
}

describe('api route catalog', () => {
	test('lists every pages/api route exactly once', () => {
		const catalogPaths = apiRouteCatalog.map((entry) => entry.canonicalPath).toSorted()
		const filePaths = collectSourceFiles(pagesApiDir, ['.ts']).map(routePathFromFile).toSorted()

		expect(new Set(catalogPaths).size).toBe(catalogPaths.length)
		expect(filePaths).toEqual(catalogPaths)
	})

	test('points every catalog entry at an existing route file', () => {
		for (const entry of apiRouteCatalog) {
			expect(existsSync(filePathForEntry(entry)), `${entry.canonicalPath} should resolve to a route file`).toBe(true)
		}
	})

	test('marks the cross-instance revalidation route as POST-only', () => {
		expect(
			apiRouteCatalog.find((entry) => entry.canonicalPath === '/api/private/revalidate-instances')?.methods
		).toEqual(['POST'])
	})

	test('marks the authenticated UTR leaderboard route as GET-only', () => {
		expect(apiRouteCatalog.find((entry) => entry.canonicalPath === '/api/private/utr/leaderboard')?.methods).toEqual([
			'GET'
		])
	})

	test('keeps auth-sensitive reads out of public routes', () => {
		const forbiddenPatterns = [
			/validateSubscription/,
			/headers\??\.authorization/,
			/headers\[['"]authorization['"]\]/,
			/authorizationHeader\s*\(/,
			/req\.cookies/,
			/cookies\[/
		]

		for (const entry of apiRouteCatalog.filter((route) => route.kind === 'public')) {
			const source = readFileSync(filePathForEntry(entry), 'utf8')

			for (const pattern of forbiddenPatterns) {
				expect(source, `${entry.canonicalPath} should not match ${pattern}`).not.toMatch(pattern)
			}
		}
	})

	test('keeps shared cache headers out of private routes', () => {
		for (const entry of apiRouteCatalog.filter((route) => route.kind === 'private')) {
			const source = readFileSync(filePathForEntry(entry), 'utf8')

			expect(source, `${entry.canonicalPath} should not emit shared-cache headers`).not.toMatch(
				/res\.setHeader\(\s*['"]Cache-Control['"][\s\S]{0,160}public,/
			)
		}
	})

	test('keeps production relative API paths on canonical grouped URLs', () => {
		const legacyApiPaths: Array<string> = []

		for (const filePath of collectSourceFiles(srcDir, ['.ts', '.tsx']).filter(isProductionSourceFile)) {
			const relativePath = relative(process.cwd(), filePath)
			const lines = readFileSync(filePath, 'utf8').split('\n')

			for (const [index, line] of lines.entries()) {
				if (line.trim().startsWith('//')) continue

				for (const apiPath of findLegacyRelativeApiPaths(line)) {
					if (apiPath === '/api/:path*') continue
					legacyApiPaths.push(`${relativePath}:${index + 1} ${apiPath}`)
				}
			}
		}

		expect(legacyApiPaths).toEqual([])
	})

	test('distinguishes external URL checks from app API requests', () => {
		expect(findLegacyRelativeApiPaths("url.pathname.startsWith('/api/webhooks/')")).toEqual([])
		expect(findLegacyRelativeApiPaths("fetch('/api/webhooks/create')")).toEqual(['/api/webhooks/create'])
	})

	test('keeps removed route buckets and imports from returning', () => {
		const staleReferences: Array<string> = []
		const stalePatterns = [
			staleReference('/api/public/', 'datasets'),
			staleReference('/api/private/', 'datasets'),
			staleReference('/api/dynamic/', 'datasets'),
			staleReference('/api/public/protocols/', 'split'),
			staleReference('~/server/', 'routeCache'),
			staleReference('server/', 'routeCache'),
			staleReference('server/', 'cexAnalytics'),
			staleReference('ProDashboard/server/', 'datasetFetchers'),
			staleReference('protocol', 'Split')
		]

		for (const filePath of collectSourceFiles(srcDir, ['.ts', '.tsx', '.md']).filter((filePath) => {
			if (filePath === apiRouteCatalogFile) return false
			if (filePath === apiRouteCatalogTestFile) return false
			return !filePath.includes(`${sep}node_modules${sep}`)
		})) {
			const source = readFileSync(filePath, 'utf8')
			const relativePath = relative(process.cwd(), filePath)
			for (const pattern of stalePatterns) {
				if (source.includes(pattern)) {
					staleReferences.push(`${relativePath} contains ${pattern}`)
				}
			}
		}

		expect(staleReferences).toEqual([])
	})
})
