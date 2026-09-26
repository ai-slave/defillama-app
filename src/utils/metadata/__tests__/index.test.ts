import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { SERVER_URL } from '~/constants'
import { installSnapshotDirectory } from '~/utils/testing/snapshotDirectory'
import { installTelemetrySink } from '~/utils/testing/telemetry'
import type { CoreMetadataPayload } from '../artifactContract'
import { writeMetadataArtifacts } from '../artifactWriter'
import { getMetadataCacheDir } from '../config'
import { serveCoreMetadata } from './sourceFixture'
const protocolsUrl = `${SERVER_URL}/config/smol/appMetadata-protocols.json`
const telemetry = installTelemetrySink()
installSnapshotDirectory('metadata-refresh-test')
const protocolRequests = () =>
	telemetry.requests.filter(({ url }) => url.pathname.endsWith('/appMetadata-protocols.json'))
// Each caller names its source, so the refresh that ran is the one whose source reaches telemetry.
const refreshSources = async () => {
	const sources: Array<string> = []
	for (const event of await telemetry.events()) {
		if (event.type === 'domain_event' && event.event_name === 'metadata.refresh') sources.push(event.subject)
	}
	return sources
}
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

		metadataModule.refreshMetadataInBackgroundIfStale('homepage')
		metadataModule.refreshMetadataInBackgroundIfStale('tokens')

		await vi.waitFor(() => expect(protocolRequests()).toHaveLength(1))
		expect(metadata.protocolMetadata).toBe(initialProtocolMetadata)

		deferred.resolve(refreshedProtocols)
		await vi.waitFor(() => expect(metadata.protocolMetadata).toEqual(refreshedProtocols))

		expect(metadata.protocolDisplayNames.get('morpho')).toBe('Morpho')
		expect(protocolRequests()).toHaveLength(1)
	})

	test('records successful metadata refresh telemetry', async () => {
		const clock = vi.spyOn(Date, 'now').mockReturnValue(1000)
		telemetry.serve({
			[protocolsUrl]: () => {
				clock.mockReturnValue(1250)
				return createMetadataPayload().protocols
			}
		})
		const metadataModule = await import('../index')

		metadataModule.refreshMetadataInBackgroundIfStale('homepage')

		await vi.waitFor(async () =>
			expect(await telemetry.events()).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						event_name: 'metadata.refresh',
						level: 'info',
						subject: 'homepage',
						message: 'Metadata refresh completed',
						attributes: expect.objectContaining({
							duration_ms: 250,
							source: 'homepage',
							status: 'success'
						})
					})
				])
			)
		)
		clock.mockRestore()
	})

	test('records failed metadata refresh telemetry', async () => {
		const clock = vi.spyOn(Date, 'now').mockReturnValue(1000)
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
		telemetry.serve({
			[protocolsUrl]: () => {
				clock.mockReturnValue(1400)
				throw new Error('metadata failed')
			}
		})
		const metadataModule = await import('../index')

		metadataModule.refreshMetadataInBackgroundIfStale('homepage')

		await vi.waitFor(async () =>
			expect(await telemetry.events()).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						event_name: 'metadata.refresh',
						level: 'warn',
						subject: 'homepage',
						message: 'Metadata refresh failed',
						attributes: expect.objectContaining({
							duration_ms: 400,
							error_message: 'metadata failed',
							error_name: 'Error',
							source: 'homepage',
							status: 'failure'
						})
					})
				])
			)
		)
		expect(consoleErrorSpy).toHaveBeenCalledWith(
			'[metadata] refresh failed from homepage, keeping stale cache:',
			expect.any(Error)
		)
		consoleErrorSpy.mockRestore()
		clock.mockRestore()
	})

	test('applies the refresh cooldown after failed refreshes', async () => {
		vi.stubEnv('NODE_ENV', 'production')
		const clock = vi.spyOn(Date, 'now').mockReturnValue(1000)
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
		telemetry.serve({
			[protocolsUrl]: () => {
				throw new Error('metadata failed')
			}
		})
		const metadataModule = await import('../index')

		metadataModule.refreshMetadataInBackgroundIfStale('homepage')
		await vi.waitFor(async () => expect(await refreshSources()).toEqual(['homepage']))

		// A refresh started here would still be in flight for the next caller, which would then report its source.
		metadataModule.refreshMetadataInBackgroundIfStale('during_cooldown')
		clock.mockReturnValue(1000 + 60 * 60 * 1000)
		metadataModule.refreshMetadataInBackgroundIfStale('after_cooldown')

		await vi.waitFor(async () => expect(await refreshSources()).toEqual(['homepage', 'after_cooldown']))
		expect(protocolRequests()).toHaveLength(2)
		consoleErrorSpy.mockRestore()
		clock.mockRestore()
	})

	test('skips refresh in local development without an API key', async () => {
		vi.stubEnv('NODE_ENV', 'development')
		vi.stubEnv('API_KEY', '')
		const metadataModule = await import('../index')

		metadataModule.refreshMetadataInBackgroundIfStale('without_api_key')
		vi.stubEnv('API_KEY', 'local-key')
		metadataModule.refreshMetadataInBackgroundIfStale('with_api_key')

		await vi.waitFor(async () => expect(await refreshSources()).toEqual(['with_api_key']))
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
		randomSpy.mockRestore()
	})
})
