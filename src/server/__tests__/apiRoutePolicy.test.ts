import { readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, test } from 'vitest'
import { collectSourceFiles } from '../../../scripts/lib/sourceFiles'

const pagesApiDir = join(process.cwd(), 'src/pages/api')
const srcDir = join(process.cwd(), 'src')

function isProductionSourceFile(filePath: string) {
	if (!/\.(ts|tsx)$/.test(filePath)) return false
	if (filePath.includes(`${sep}__tests__${sep}`)) return false
	if (filePath.includes(`${sep}utils${sep}test${sep}`)) return false
	if (/\.(test|spec)\.(ts|tsx)$/.test(filePath)) return false
	return true
}

// /api/collections/ is PocketBase's namespace: those paths are sent through the
// PocketBase client against POCKETBASE_URL, not this app's API routes.
const legacyRelativeApiPathPattern = /['"`](\/api\/(?!public\/|private\/|dynamic\/|og\/|collections\/)[^'"`\s)]*)/g

function findLegacyRelativeApiPaths(line: string) {
	const paths: Array<string> = []
	for (const match of line.matchAll(legacyRelativeApiPathPattern)) {
		// A parsed external URL can share the /api namespace without calling this app.
		if (/\.pathname\.startsWith\(\s*$/.test(line.slice(0, match.index))) continue
		paths.push(match[1])
	}
	return paths
}

describe('api route policy', () => {
	// Public routes are shared-cacheable, so a handler that reads auth would cache one user's response for everyone.
	test('keeps auth-sensitive reads out of public routes', () => {
		const forbiddenPatterns = [
			/validateSubscription/,
			/headers\??\.authorization/,
			/headers\[['"]authorization['"]\]/,
			/authorizationHeader\s*\(/,
			/req\.cookies/,
			/cookies\[/
		]

		for (const filePath of collectSourceFiles(join(pagesApiDir, 'public'), ['.ts'])) {
			const source = readFileSync(filePath, 'utf8')

			for (const pattern of forbiddenPatterns) {
				expect(source, `${relative(process.cwd(), filePath)} should not match ${pattern}`).not.toMatch(pattern)
			}
		}
	})

	test('keeps shared cache headers out of private routes', () => {
		for (const filePath of collectSourceFiles(join(pagesApiDir, 'private'), ['.ts'])) {
			const source = readFileSync(filePath, 'utf8')

			expect(source, `${relative(process.cwd(), filePath)} should not emit shared-cache headers`).not.toMatch(
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
})
