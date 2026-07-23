import { promises as fs } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import nextConfig from '../../../../next.config'
import {
	getStaticGenerationConfig,
	VERCEL_STATIC_GENERATION_MAX_CONCURRENCY
} from '../../../../scripts/command/buildConfig'
import type { DatasetSnapshotDomain } from '../contract'
import { DATASET_SNAPSHOT_ROUTE_DOMAINS, getDatasetSnapshotTraceIncludes } from '../traceIncludes'

const SNAPSHOT_ENTRY_IMPORTS: Array<{ importPath: string; domains: DatasetSnapshotDomain[] }> = [
	{ importPath: '~/containers/Yields/server/dataset.server', domains: ['yields'] },
	{ importPath: '~/containers/Yields/server/api', domains: ['yields'] },
	{ importPath: '~/containers/LiquidationsV2/server/dataset.server', domains: ['liquidations'] },
	{ importPath: '~/containers/LiquidationsV2/server/routes', domains: ['liquidations'] },
	{ importPath: '~/containers/Markets/server/dataset.server', domains: ['markets'] },
	{ importPath: '~/containers/Markets/server/api', domains: ['markets'] },
	{ importPath: '~/containers/Raises/server/dataset.server', domains: ['raises'] },
	{ importPath: '~/containers/Treasuries/server/dataset.server', domains: ['treasuries'] },
	{ importPath: '~/containers/TokenRights/server/dataset.server', domains: ['token-rights'] },
	{ importPath: '~/containers/Token/server/dataset.liquidity.server', domains: ['liquidity'] },
	{ importPath: '~/containers/Token/server/dataset.risk.server', domains: ['risk'] },
	{ importPath: '~/containers/Tokens/queries.server', domains: ['markets', 'token-rights'] },
	{ importPath: '~/containers/Tokens/server/api', domains: ['markets', 'token-rights'] },
	{ importPath: '~/containers/ProDashboard/server/stream', domains: ['yields'] },
	{ importPath: '~/server/routeRegistry/sitemap', domains: ['markets', 'liquidations', 'raises'] }
]

async function collectPageFiles(rootDir: string): Promise<string[]> {
	const files: string[] = []
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
	for (const [pattern, patternDomains] of Object.entries(DATASET_SNAPSHOT_ROUTE_DOMAINS) as Array<
		[string, readonly DatasetSnapshotDomain[]]
	>) {
		if (routeMatches(pattern, route)) for (const domain of patternDomains) domains.add(domain)
	}
	return domains
}

describe('dataset snapshot output tracing', () => {
	it('limits Vercel static-generation concurrency without changing other builds', () => {
		expect(getStaticGenerationConfig('1')).toEqual({
			staticGenerationMaxConcurrency: VERCEL_STATIC_GENERATION_MAX_CONCURRENCY
		})
		expect(getStaticGenerationConfig(undefined)).toBeUndefined()
	})

	it('permanently redirects the retired Markets page to Exchanges', async () => {
		const redirects = await nextConfig.redirects?.()

		expect(redirects).toContainEqual({
			source: '/markets',
			destination: '/exchanges',
			permanent: true
		})
	})

	it('assigns composed and transitive consumers every domain they require', () => {
		expect(DATASET_SNAPSHOT_ROUTE_DOMAINS['/token/*']).toEqual([
			'markets',
			'liquidations',
			'raises',
			'treasuries',
			'yields',
			'liquidity',
			'token-rights',
			'risk'
		])
		expect(DATASET_SNAPSHOT_ROUTE_DOMAINS['/tokens']).toEqual(['markets', 'token-rights'])
		expect(DATASET_SNAPSHOT_ROUTE_DOMAINS['/protocol/*']).toEqual(['yields', 'markets', 'token-rights'])
		expect(DATASET_SNAPSHOT_ROUTE_DOMAINS['/sitemap.xml']).toEqual(['markets', 'liquidations', 'raises'])
	})

	it('never attaches the complete snapshot tree to every route', () => {
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

	it('does not trace Yields snapshots into routes that never read them', () => {
		const includes = getDatasetSnapshotTraceIncludes()

		expect(includes['/yields/watchlist']).toBeUndefined()
		expect(includes['/yields/rates']).toBeUndefined()
		expect(includes['/yields/borrow/*']).toBeUndefined()
	})

	it('covers every page and API that imports a snapshot entry module', async () => {
		const missing: string[] = []
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
