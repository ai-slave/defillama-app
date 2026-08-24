import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchEmissionsProtocolsListMock, fetchWithPoolingOnServerMock } = vi.hoisted(() => ({
	fetchEmissionsProtocolsListMock: vi.fn(),
	fetchWithPoolingOnServerMock: vi.fn()
}))

vi.mock('~/utils/http-client', () => ({
	fetchWithPoolingOnServer: fetchWithPoolingOnServerMock
}))

vi.mock('~/containers/Unlocks/api', async (importOriginal) => ({
	...(await importOriginal<typeof import('~/containers/Unlocks/api')>()),
	fetchEmissionsProtocolsList: fetchEmissionsProtocolsListMock
}))

function jsonResponse(payload: unknown): Response {
	return new Response(JSON.stringify(payload), {
		headers: {
			'content-type': 'application/json'
		}
	})
}

function withoutCacheVersion(url: string): string {
	const parsed = new URL(url)
	parsed.searchParams.delete('zz')
	return parsed.toString()
}

function responseForUrl(url: string): unknown {
	url = withoutCacheVersion(url)
	if (url.includes('appMetadata-protocols.json')) return { 'parent#aave': { name: 'aave', tvl: true } }
	if (url.includes('appMetadata-chains.json')) return { Ethereum: { name: 'Ethereum', id: 'ethereum' } }
	if (url.includes('appMetadata-categoriesAndTags.json')) {
		return { categories: [], tags: [], tagCategoryMap: {}, configs: {} }
	}
	if (url.endsWith('/chains2')) return { categories: ['EVM'] }
	if (url.endsWith('/cexs')) return { cexs: [], cg_volume_cexs: ['binance'] }
	if (url.includes('/rwa/list') || url === 'https://rwa.example.com/list') {
		return { canonicalMarketIds: [], platforms: [], chains: [], categories: [], assetGroups: [], idMap: {} }
	}
	if (url.includes('/rwa/rwa/platforms') || url === 'https://rwa.example.com/rwa/platforms') {
		return { generatedAt: 0, byPid: {}, platforms: {} }
	}
	if (url.includes('/rwa-perps/list') || url === 'https://rwa-perps.example.com/list') {
		return { contracts: [], venues: [], categories: [], assetGroups: [], total: 0 }
	}
	if (url.includes('/tokenlist/rankings.json')) return []
	if (url.includes('/config/smol/token.json')) return {}
	if (url.includes('/liquidations/all') || url === 'https://liquidations.example.com/all') {
		return { data: {}, tokens: {}, validThresholds: [], timestamp: 0 }
	}
	if (url.includes('/bridges?includeChains=true')) return { bridges: [], chains: [] }
	if (url.includes('/emissionsSupplyMetrics')) return {}
	if (url.endsWith('/emissions')) return []
	if (url.includes('/equities/v1/companies-list') || url.endsWith('/v1/companies-list')) {
		return [{ ticker: 'NVDA', companyName: 'NVIDIA Corporation', country: 'US', countryName: 'United States' }]
	}
	throw new Error(`unexpected URL: ${url}`)
}

function expectMetadataRequest(url: string): void {
	expect(fetchWithPoolingOnServerMock.mock.calls.map(([calledUrl]) => withoutCacheVersion(calledUrl))).toContain(url)
}

describe('metadata source adapters', () => {
	beforeEach(() => {
		vi.resetModules()
		vi.unstubAllEnvs()
		fetchEmissionsProtocolsListMock.mockReset()
		fetchWithPoolingOnServerMock.mockReset()
		fetchWithPoolingOnServerMock.mockImplementation((url: string) => Promise.resolve(jsonResponse(responseForUrl(url))))
		fetchEmissionsProtocolsListMock.mockResolvedValue(['aave'])
	})

	it('fetches metadata sources from expected public URLs with the metadata timeout', async () => {
		vi.stubEnv('API_KEY', '')
		const { fetchCoreMetadataSources } = await import('../sources')

		const sources = await fetchCoreMetadataSources()

		expect(sources.protocols).toEqual({ 'parent#aave': { name: 'aave', tvl: true } })
		expect(sources.equitiesCompanyRoutes).toEqual([{ ticker: 'NVDA', country: 'US' }])
		expectMetadataRequest('https://api.llama.fi/config/smol/appMetadata-protocols.json')
		expectMetadataRequest('https://api.llama.fi/rwa/list')
		expectMetadataRequest('https://api.llama.fi/rwa/rwa/platforms')
		expectMetadataRequest('https://defillama-datasets.llama.fi/tokenlist/rankings.json')
		expect(fetchWithPoolingOnServerMock).toHaveBeenCalledWith('https://api.llama.fi/config/smol/token.json', {
			timeout: 180_000
		})
		expect(fetchWithPoolingOnServerMock).toHaveBeenCalledWith('https://bridges.llama.fi/bridges?includeChains=true', {
			timeout: 180_000
		})
		expect(fetchWithPoolingOnServerMock).toHaveBeenCalledWith('https://api.llama.fi/emissions', { timeout: 180_000 })
		expect(fetchWithPoolingOnServerMock).toHaveBeenCalledWith(
			'https://defillama-datasets.llama.fi/emissionsSupplyMetrics',
			{ timeout: 180_000 }
		)
		expectMetadataRequest('https://api.llama.fi/equities/v1/companies-list')
		expect(fetchEmissionsProtocolsListMock).toHaveBeenCalledWith({ timeout: 180_000 })
	})

	it('keeps token directory on the public API when other metadata sources use pro API', async () => {
		vi.stubEnv('API_KEY', 'secret-key')
		const { fetchCoreMetadataSources } = await import('../sources')

		await fetchCoreMetadataSources()

		expectMetadataRequest('https://pro-api.llama.fi/secret-key/api/config/smol/appMetadata-protocols.json')
		expect(fetchWithPoolingOnServerMock).toHaveBeenCalledWith('https://api.llama.fi/config/smol/token.json', {
			timeout: 180_000
		})
		expect(fetchWithPoolingOnServerMock).not.toHaveBeenCalledWith(
			'https://pro-api.llama.fi/secret-key/api/config/smol/token.json',
			expect.anything()
		)
		expect(fetchWithPoolingOnServerMock).toHaveBeenCalledWith('https://pro-api.llama.fi/secret-key/api/emissions', {
			timeout: 180_000
		})
		expectMetadataRequest('https://pro-api.llama.fi/secret-key/equities/v1/companies-list')
	})

	it('fetches metadata sources from direct URL overrides before pro API fallbacks', async () => {
		vi.stubEnv('API_KEY', 'secret-key')
		vi.stubEnv('BRIDGES_SERVER_URL', 'https://bridges.example.com/')
		vi.stubEnv('DATASETS_SERVER_URL', 'https://datasets.example.com/')
		vi.stubEnv('LIQUIDATIONS_SERVER_URL_V2', 'https://liquidations.example.com/')
		vi.stubEnv('EQUITIES_SERVER_URL', 'https://equities.example.com/v1/')
		vi.stubEnv('RWA_PERPS_SERVER_URL', 'https://rwa-perps.example.com/')
		vi.stubEnv('RWA_SERVER_URL', 'https://rwa.example.com/')
		vi.stubEnv('SERVER_URL', 'https://core.example.com/api/')
		const { fetchCoreMetadataSources } = await import('../sources')

		await fetchCoreMetadataSources()

		expectMetadataRequest('https://core.example.com/api/config/smol/appMetadata-protocols.json')
		expectMetadataRequest('https://rwa.example.com/list')
		expectMetadataRequest('https://rwa.example.com/rwa/platforms')
		expectMetadataRequest('https://rwa-perps.example.com/list')
		expectMetadataRequest('https://datasets.example.com/tokenlist/rankings.json')
		expectMetadataRequest('https://liquidations.example.com/all')
		expect(fetchWithPoolingOnServerMock).toHaveBeenCalledWith(
			'https://bridges.example.com/bridges?includeChains=true',
			{ timeout: 180_000 }
		)
		expectMetadataRequest('https://equities.example.com/v1/companies-list')
	})

	it('logs the named metadata source when an upstream request fails', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
		fetchWithPoolingOnServerMock.mockImplementation((url: string) => {
			if (withoutCacheVersion(url).endsWith('/cexs')) {
				return Promise.resolve(new Response('upstream failed', { status: 503 }))
			}
			return Promise.resolve(jsonResponse(responseForUrl(url)))
		})
		const { fetchCoreMetadataSources } = await import('../sources')

		await expect(fetchCoreMetadataSources()).rejects.toThrow('Metadata request failed')
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('[dev:prepare] Metadata cache: CEX metadata API failed:'))

		warn.mockRestore()
	})

	it('rejects instead of seeding an empty emissions directory when the protocol list fails', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
		fetchEmissionsProtocolsListMock.mockRejectedValue(new Error('emissions list unavailable'))
		const { fetchCoreMetadataSources } = await import('../sources')

		await expect(fetchCoreMetadataSources()).rejects.toThrow('emissions list unavailable')
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining('[dev:prepare] Metadata cache: emissions protocols API failed:')
		)

		warn.mockRestore()
	})
})
