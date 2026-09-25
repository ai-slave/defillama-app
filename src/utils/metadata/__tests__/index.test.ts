import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { SERVER_URL } from '~/constants'
import { installSnapshotDirectory } from '~/utils/test/snapshotDirectory'
import { installTelemetrySink } from '~/utils/test/telemetry'
import type { CoreMetadataPayload } from '../artifactContract'
import { writeMetadataArtifacts } from '../artifactWriter'
import { getMetadataCacheDir } from '../config'
import { serveCoreMetadata } from './sourceFixture'
const protocolsUrl = `${SERVER_URL}/config/smol/appMetadata-protocols.json`
const telemetry = installTelemetrySink()
installSnapshotDirectory('metadata-refresh-test')
const protocolRequests = () =>
	telemetry.requests.filter(({ url }) => url.pathname.endsWith('/appMetadata-protocols.json'))
afterEach(() => {
	vi.clearAllTimers()
	vi.useRealTimers()
})

const defaultTokenListEntry = {
	symbol: 'AAVE',
	current_price: null,
	price_change_24h: null,
	price_change_percentage_24h: null,
	ath: null,
	ath_date: null,
	atl: null,
	atl_date: null,
	market_cap: null,
	fully_diluted_valuation: null,
	total_volume: null,
	total_supply: null,
	circulating_supply: null,
	max_supply: null
}

function createMetadataPayload(overrides: Partial<CoreMetadataPayload> = {}): CoreMetadataPayload {
	return {
		protocols: {
			'parent#aave': {
				name: 'aave',
				displayName: 'Aave',
				tvl: true
			}
		},
		chains: {
			Ethereum: {
				name: 'Ethereum',
				id: 'ethereum'
			}
		},
		categoriesAndTags: {
			categories: [],
			tags: [],
			tagCategoryMap: {},
			configs: {}
		},
		cexs: [],
		rwaList: {
			canonicalMarketIds: [],
			platforms: [],
			chains: [],
			categories: [],
			assetGroups: [],
			idMap: {}
		},
		rwaPlatformsIndex: { generatedAt: 0, byPid: {}, platforms: {} },
		rwaPerpsList: {
			contracts: [],
			venues: [],
			categories: [],
			assets: [],
			assetGroups: [],
			total: 0
		},
		tokenlist: {
			aave: defaultTokenListEntry
		},
		tokenDirectory: {},
		protocolDisplayNames: {
			aave: 'Aave'
		},
		chainDisplayNames: {
			ethereum: 'Ethereum'
		},
		chainCategories: [],
		liquidationsTokenSymbols: [],
		emissionsProtocolsList: [],
		emissionsSupplyMetrics: {},
		emissionsHistoricalPrices: {},
		cgExchangeIdentifiers: [],
		bridgeProtocolSlugs: [],
		bridgeChainSlugs: [],
		bridgeChainSlugToName: {},
		narrativeCategories: { ids: [], nameById: {} },
		oracleRoutes: { oracleNameBySlug: {}, chainNameBySlug: {}, chainSlugsByOracleSlug: {} },
		digitalAssetTreasuryRoutes: { assetSlugs: [], companySlugs: [] },
		stablecoinPeggedAssetSlugs: [],
		equitiesCompanyRoutes: [],
		preIpoCompanyIds: [],
		tokenFilterMetadata: {
			schemaVersion: 2,
			generatedAt: 0,
			sources: { coingeckoCatalogGeneratedAt: 0, rankingsUpdatedAt: null },
			tokens: {},
			categories: []
		},
		...overrides
	}
}

function createDeferred<T>() {
	let resolve: (value: T) => void
	const promise = new Promise<T>((resolvePromise) => {
		resolve = resolvePromise
	})

	return {
		promise,
		resolve: resolve!
	}
}

describe('metadata refresh', () => {
	beforeEach(async () => {
		serveCoreMetadata(telemetry)
		await writeMetadataArtifacts(getMetadataCacheDir(), createMetadataPayload(), 'stub', 0)
	})

	test('starts a background refresh without blocking and dedupes concurrent callers', async () => {
		const refreshedProtocols = {
			'parent#morpho': {
				name: 'morpho',
				displayName: 'Morpho',
				tvl: true
			}
		}
		const deferred = createDeferred<CoreMetadataPayload['protocols']>()
		telemetry.serve({ [protocolsUrl]: () => deferred.promise })

		const metadataModule = await import('../index')
		const metadata = metadataModule.default
		const initialProtocolMetadata = metadata.protocolMetadata

		metadataModule.refreshMetadataInBackgroundIfStale()
		metadataModule.refreshMetadataInBackgroundIfStale()

		await vi.waitFor(() => expect(protocolRequests()).toHaveLength(1))
		expect(metadata.protocolMetadata).toBe(initialProtocolMetadata)

		deferred.resolve(refreshedProtocols)
		await metadataModule.refreshMetadataIfStale()

		expect(metadata.protocolMetadata).toEqual(refreshedProtocols)
		expect(metadata.protocolDisplayNames.get('morpho')).toBe('Morpho')
		expect(protocolRequests()).toHaveLength(1)
	})

	test('records successful metadata refresh telemetry', async () => {
		vi.useFakeTimers()
		vi.setSystemTime(1000)
		telemetry.serve({
			[protocolsUrl]: () => {
				vi.setSystemTime(1250)
				return createMetadataPayload().protocols
			}
		})
		const metadataModule = await import('../index')

		await metadataModule.refreshMetadataIfStale()

		expect(await telemetry.events()).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					event_name: 'metadata.refresh',
					level: 'info',
					subject: 'manual',
					message: 'Metadata refresh completed',
					attributes: expect.objectContaining({
						duration_ms: 250,
						source: 'manual',
						status: 'success'
					})
				})
			])
		)
	})

	test('records failed metadata refresh telemetry', async () => {
		vi.useFakeTimers()
		vi.setSystemTime(1000)
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
		telemetry.serve({
			[protocolsUrl]: () => {
				vi.setSystemTime(1400)
				throw new Error('metadata failed')
			}
		})
		const metadataModule = await import('../index')

		await metadataModule.refreshMetadataIfStale()

		expect(await telemetry.events()).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					event_name: 'metadata.refresh',
					level: 'warn',
					subject: 'manual',
					message: 'Metadata refresh failed',
					attributes: expect.objectContaining({
						duration_ms: 400,
						error_message: 'metadata failed',
						error_name: 'Error',
						source: 'manual',
						status: 'failure'
					})
				})
			])
		)
		consoleErrorSpy.mockRestore()
	})

	test('applies the refresh cooldown after failed refreshes', async () => {
		vi.stubEnv('NODE_ENV', 'production')
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
		telemetry.serve({
			[protocolsUrl]: () => {
				throw new Error('metadata failed')
			}
		})
		const metadataModule = await import('../index')

		await metadataModule.refreshMetadataIfStale()
		await metadataModule.refreshMetadataIfStale()

		expect(protocolRequests()).toHaveLength(1)
		expect(metadataModule.getMetadataRefreshStatus()).toMatchObject({ failedRefreshes: 1, retrySuppressions: 1 })
		expect(consoleErrorSpy).toHaveBeenCalledWith('[metadata] refresh failed, keeping stale cache:', expect.any(Error))
		consoleErrorSpy.mockRestore()
	})

	test('skips refresh in local development without an API key', async () => {
		vi.stubEnv('NODE_ENV', 'development')
		vi.stubEnv('API_KEY', '')
		const metadataModule = await import('../index')

		await metadataModule.refreshMetadataIfStale()
		metadataModule.refreshMetadataInBackgroundIfStale()

		expect(protocolRequests()).toHaveLength(0)

		vi.stubEnv('API_KEY', 'local-key')
		await metadataModule.refreshMetadataIfStale()

		expect(protocolRequests()).toHaveLength(1)
	})

	test('runs the runtime refresh loop with initial and per-fetch jitter', async () => {
		vi.useFakeTimers()
		vi.setSystemTime(1000)
		vi.stubEnv('NODE_ENV', 'production')
		await writeMetadataArtifacts(getMetadataCacheDir(), createMetadataPayload(), 'ready', 0)
		const randomSpy = vi.spyOn(Math, 'random')
		randomSpy.mockReturnValueOnce(0.5).mockReturnValueOnce(0.25)

		await import('../index')
		await vi.advanceTimersByTimeAsync(150_000 - 1)
		expect(protocolRequests()).toHaveLength(0)

		await vi.advanceTimersByTimeAsync(1)
		expect(protocolRequests()).toHaveLength(0)

		await vi.advanceTimersByTimeAsync(75_000 - 1)
		expect(protocolRequests()).toHaveLength(0)

		await vi.advanceTimersByTimeAsync(1)
		expect(protocolRequests()).toHaveLength(1)
		const metadataModule = await import('../index')
		expect(metadataModule.getMetadataRefreshStatus().jitteredRefreshAttempts).toBe(1)
		randomSpy.mockRestore()
	})
})
