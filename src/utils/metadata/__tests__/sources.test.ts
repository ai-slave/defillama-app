import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { PreIpoCompanyListItem, PreIpoSnapshot } from '~/containers/PreIPO/api.types'
import { installFixtureFetch, fixtureStatus } from '~/utils/testing/fixtureFetch'
const http = installFixtureFetch()

const preIpoCompaniesSnapshot = {
	updatedAt: '2026-08-25T00:00:00.000Z',
	data: [
		{
			id: 'anthropic',
			name: 'Anthropic',
			description: 'AI company',
			website: 'https://anthropic.com',
			sector: 'Artificial Intelligence',
			latestEstimatedValuation: 1000,
			latestRaise: 100,
			latestFundingValuation: 900,
			latestFundingDate: '2026-08-24',
			lastValuationDate: '2026-08-25',
			totalRaised: 500,
			valuationChange1YPercentage: 10,
			premiumVsLatestFundingPercentage: 11.11
		}
	]
} satisfies PreIpoSnapshot<Array<PreIpoCompanyListItem>>

function withoutCacheVersion(url: string): string {
	const parsed = new URL(url)
	parsed.searchParams.delete('cachebust')
	return parsed.toString()
}

function responseForUrl(rawUrl: string): unknown {
	const url = withoutCacheVersion(rawUrl)
	if (url.includes('appMetadata-protocols.json')) return { 'parent#aave': { name: 'aave', tvl: true } }
	if (url.includes('appMetadata-chains.json')) return { Ethereum: { name: 'Ethereum', id: 'ethereum' } }
	if (url.includes('appMetadata-categoriesAndTags.json')) {
		return { categories: [], tags: [], tagCategoryMap: {}, configs: {} }
	}
	if (url.endsWith('/chains2')) return { categories: ['EVM'] }
	if (url.endsWith('/cexs')) return { cexs: [], cg_volume_cexs: ['binance'] }
	if (url.includes('/rwa/list') || url === 'https://rwa.example.com/list') {
		return {
			canonicalMarketIds: [],
			platforms: [],
			chains: [],
			categories: [],
			assetGroups: [],
			idMap: {}
		}
	}
	if (url.includes('/rwa/rwa/platforms') || url === 'https://rwa.example.com/rwa/platforms') {
		return { generatedAt: 0, byPid: {}, platforms: {} }
	}
	if (url.includes('/protocol-mcap')) {
		return { generatedAt: 0, protocols: [] }
	}
	if (url.includes('/rwa-perps/list') || url.startsWith('https://rwa-perps.example.com/list')) {
		return {
			contracts: [],
			venues: [],
			categories: [],
			assetGroups: [],
			total: 0
		}
	}
	if (url.includes('/tokenlist/rankings.json')) return []
	if (url.includes('/tokenlist/filters.json')) {
		return {
			schemaVersion: 1,
			generatedAt: 1,
			sources: { coingeckoCatalogGeneratedAt: 1, rankingsUpdatedAt: null },
			tokens: {},
			categories: []
		}
	}
	if (url.includes('/config/smol/token.json')) return {}
	if (url.includes('/liquidations/all') || url === 'https://liquidations.example.com/all') {
		return { data: {}, tokens: {}, validThresholds: [], timestamp: 0 }
	}
	if (url.includes('/bridges?includeChains=true')) return { bridges: [], chains: [] }
	if (url.includes('/emissionsProtocolsList')) return ['aave']
	if (url.includes('/emissionsSupplyMetrics')) return {}
	if (url.endsWith('/emissions')) return []
	if (url.includes('pre-ipo') && url.endsWith('/v1/companies-list')) {
		return preIpoCompaniesSnapshot
	}
	if (url.includes('/equities/v1/companies-list') || url.endsWith('/v1/companies-list')) {
		return [
			{
				ticker: 'NVDA',
				companyName: 'NVIDIA Corporation',
				country: 'US',
				countryName: 'United States'
			}
		]
	}
	throw new Error(`unexpected URL: ${url}`)
}

describe('metadata source adapters', () => {
	beforeEach(() => {
		vi.resetModules()
		vi.unstubAllEnvs()
		http.serve({ 'https://': (url: URL) => responseForUrl(url.href) })
	})

	test('parses protocols, company routes and the emissions list from the metadata sources', async () => {
		vi.stubEnv('API_KEY', '')
		const { fetchCoreMetadataSources } = await import('../sources')

		const sources = await fetchCoreMetadataSources()

		expect(sources.protocols).toEqual({
			'parent#aave': { name: 'aave', tvl: true }
		})
		expect(sources.equitiesCompanyRoutes).toEqual([{ ticker: 'NVDA', country: 'US' }])
		expect(sources.preIpoCompanyIds).toEqual(['anthropic'])
		expect(sources.emissionsProtocolsList).toEqual(['aave'])
	})

	test('keeps token directory on the public API when other metadata sources use pro API', async () => {
		vi.stubEnv('API_KEY', 'secret-key')
		const { fetchCoreMetadataSources } = await import('../sources')

		await fetchCoreMetadataSources()

		expect(http.urls().map(withoutCacheVersion)).toContain('https://api.llama.fi/config/smol/token.json')
	})

	test('logs the named metadata source when an upstream request fails', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
		http.serve({
			'https://': (url: URL) =>
				withoutCacheVersion(url.href).endsWith('/cexs')
					? new Response('upstream failed', { status: 503 })
					: responseForUrl(url.href)
		})
		const { fetchCoreMetadataSources } = await import('../sources')

		await expect(fetchCoreMetadataSources()).rejects.toThrow('Metadata request failed')
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('[dev:prepare] Metadata cache: CEX metadata API failed:'))

		warn.mockRestore()
	})

	test('rejects instead of seeding an empty emissions directory when the protocol list fails', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
		http.serve({ '/emissionsProtocolsList': fixtureStatus(404) })
		const { fetchCoreMetadataSources } = await import('../sources')

		await expect(fetchCoreMetadataSources()).rejects.toThrow(/404/)
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining('[dev:prepare] Metadata cache: emissions protocols API failed:')
		)

		warn.mockRestore()
	})
})
