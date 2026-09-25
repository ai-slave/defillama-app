import { promises as fs } from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import nextConfig from '../../../../next.config'
import type { DatasetSnapshotDomain } from '../contract'
import { DATASET_SNAPSHOT_ROUTE_DOMAINS, getDatasetSnapshotTraceIncludes } from '../traceIncludes'

const SNAPSHOT_ENTRY_IMPORTS: Array<{ importPath: string; domains: Array<DatasetSnapshotDomain> }> = [
	{ importPath: '~/containers/Yields/server/dataset.server', domains: ['yields'] },
	{ importPath: '~/containers/Yields/server/api', domains: ['yields'] },
	{ importPath: '~/containers/LiquidationsV2/server/dataset.server', domains: ['liquidations'] },
	{ importPath: '~/containers/LiquidationsV2/server/routes', domains: ['liquidations'] },
	{ importPath: '~/containers/Markets/server/dataset.server', domains: ['markets'] },
	{ importPath: '~/containers/Markets/server/api', domains: ['markets'] },
	{ importPath: '~/containers/Raises/server/dataset.server', domains: ['raises'] },
	{ importPath: '~/containers/Treasuries/server/dataset.server', domains: ['treasuries'] },
	{ importPath: '~/containers/TokenRights/server/dataset.server', domains: ['token-rights'] },
	{ importPath: '~/containers/Token/server/dataset.risk.server', domains: ['risk'] },
	{ importPath: '~/containers/Tokens/queries.server', domains: ['markets', 'token-rights'] },
	{ importPath: '~/containers/Tokens/server/api', domains: ['markets', 'token-rights'] },
	{ importPath: '~/containers/ProDashboard/server/stream/index', domains: ['yields'] },
	{ importPath: '~/server/routeRegistry/sitemap', domains: ['markets', 'liquidations', 'raises'] }
]

async function collectPageFiles(rootDir: string): Promise<Array<string>> {
	const files: Array<string> = []
	for (const entry of await fs.readdir(rootDir, { withFileTypes: true })) {
		const filePath = path.join(rootDir, entry.name)
		if (entry.isDirectory()) files.push(...(await collectPageFiles(filePath)))
		else if (/\.[jt]sx?$/.test(entry.name)) files.push(filePath)
	}
	return files
}

function pageFileToRoute(filePath: string): string {
	const relativePath = path
		.relative('src/pages', filePath)
		.split(path.sep)
		.join('/')
		.replace(/\.[jt]sx?$/, '')
	const withoutIndex = relativePath === 'index' ? '' : relativePath.replace(/\/index$/, '')
	return `/${withoutIndex}`
}

function routeMatches(pattern: string, route: string): boolean {
	const doubleStar = '__DOUBLE_STAR__'
	const expression = pattern
		.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&')
		.replaceAll('**', doubleStar)
		.replaceAll('*', '[^/]*')
		.replaceAll(doubleStar, '.*')
	return new RegExp(`^${expression}$`).test(route)
}

function tracedDomainsForRoute(route: string): Set<DatasetSnapshotDomain> {
	const domains = new Set<DatasetSnapshotDomain>()
	for (const [pattern, patternDomains] of Object.entries(DATASET_SNAPSHOT_ROUTE_DOMAINS)) {
		if (routeMatches(pattern, route)) for (const domain of patternDomains) domains.add(domain)
	}
	return domains
}

describe('dataset snapshot output tracing', () => {
	test('permanently redirects the retired Markets page to Exchanges', async () => {
		const redirects = await nextConfig.redirects?.()

		expect(redirects).toContainEqual({
			source: '/markets',
			destination: '/exchanges',
			permanent: true
		})
	})

	test('never attaches the complete snapshot tree to every route', () => {
		const includes = getDatasetSnapshotTraceIncludes()
		expect(includes['/*']).toBeUndefined()
		expect(includes['/yields']).toEqual([
			'./.cache/dataset-snapshots/yields/current.json',
			'./.cache/dataset-snapshots/yields/versions/**/*'
		])
		for (const patterns of Object.values(includes)) {
			expect(patterns).not.toContain('./.cache/dataset-snapshots/**/*')
		}
		expect(nextConfig.outputFileTracingIncludes?.['/*']).toEqual(['./.cache/app-metadata/**/*'])
		expect(nextConfig.outputFileTracingIncludes?.['/yields']).toEqual(includes['/yields'])
	})

	test('covers every page and API that imports a snapshot entry module', async () => {
		const missing: Array<string> = []
		for (const filePath of await collectPageFiles('src/pages')) {
			const source = await fs.readFile(filePath, 'utf8')
			const route = pageFileToRoute(filePath)
			const tracedDomains = tracedDomainsForRoute(route)
			for (const entry of SNAPSHOT_ENTRY_IMPORTS) {
				if (!source.includes(entry.importPath)) continue
				for (const domain of entry.domains) {
					if (!tracedDomains.has(domain)) missing.push(`${route} -> ${domain}`)
				}
			}
		}
		expect(missing).toEqual([])
	})
})
