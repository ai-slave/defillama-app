import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IRWAAssetsOverview, RWAChartMetricKey } from '../api.types'
import { normalizeRwaAssetGroup } from '../assetGroup'
import type { RWAChartAggregationMode } from '../chartAggregation'
import type { RWAChartRow, RWAPositionalChartDataset } from '../chartDataset'
import {
	getRwaAssetChartQueryKey,
	getRwaOpenInterestChartQueryKey,
	hasActiveChartFilters,
	resolveRWAOverviewInclusionFlag,
	useRWAAssetCategoryPieChartData,
	useFilteredRwaAssets,
	useRwaAssetGroupPieChartData,
	useRwaChartDataset
} from '../hooks'

const useQueryMock = vi.fn()
const fetchJsonMock = vi.fn()
const DEFAULT_INCLUSION = { includeStablecoins: false, includeGovernance: false, includeRwaPerps: false }
const DEFAULT_ALL_INCLUSION = { includeStablecoins: true, includeGovernance: true, includeRwaPerps: false }
const DEFAULT_STABLECOIN_INCLUSION = { ...DEFAULT_INCLUSION, includeStablecoins: true }

function getUseQueryOptions(index: number): unknown {
	const call = useQueryMock.mock.calls[index]
	if (!call || call[0] === undefined) throw new Error(`Missing useQuery call ${index}`)
	return call[0]
}

vi.mock('@tanstack/react-query', () => ({
	useQuery: (options: unknown) => useQueryMock(options)
}))

vi.mock('~/utils/async', () => ({
	fetchJson: (...args: unknown[]) => fetchJsonMock(...args)
}))

function createSpotAsset(
	overrides: Partial<Extract<IRWAAssetsOverview['assets'][number], { kind: 'spot' }>> = {}
): Extract<IRWAAssetsOverview['assets'][number], { kind: 'spot' }> {
	return {
		id: '1',
		kind: 'spot',
		detailHref: '/rwa/asset/ondo%2Fusdy',
		canonicalMarketId: 'ondo/usdy',
		ticker: 'AAA',
		assetName: 'Alpha',
		primaryChain: null,
		chain: null,
		price: null,
		openInterest: null,
		volume24h: null,
		volume30d: null,
		assetGroup: null,
		parentPlatform: null,
		category: null,
		assetClass: null,
		accessModel: 'Unknown',
		type: null,
		rwaClassification: null,
		issuer: null,
		redeemable: null,
		attestations: null,
		cexListed: null,
		kycForMintRedeem: null,
		kycAllowlistedWhitelistedToTransferHold: null,
		transferable: null,
		selfCustody: null,
		stablecoin: false,
		governance: false,
		trueRWA: false,
		suspicious: false,
		suspiciousReason: null,
		onChainMcap: null,
		activeMcap: null,
		defiActiveTvl: { total: 0, breakdown: [] },
		defiActiveTvlByChain: { total: 0, breakdown: [] },
		...overrides
	}
}

function createPerpsAsset(
	overrides: Partial<Extract<IRWAAssetsOverview['assets'][number], { kind: 'perps' }>> = {}
): Extract<IRWAAssetsOverview['assets'][number], { kind: 'perps' }> {
	return {
		id: 'perps-1',
		kind: 'perps',
		venueType: 'DEX',
		detailHref: '/rwa/perps/contract/xyz%3Aalpha',
		contract: 'xyz:alpha',
		ticker: 'xyz:alpha',
		assetName: 'Alpha Perp',
		primaryChain: null,
		chain: null,
		price: 1,
		openInterest: 1,
		volume24h: 2,
		volume30d: 3,
		assetGroup: null,
		parentPlatform: null,
		category: null,
		assetClass: null,
		accessModel: null,
		type: 'Perp',
		rwaClassification: null,
		issuer: null,
		redeemable: null,
		attestations: null,
		cexListed: null,
		kycForMintRedeem: null,
		kycAllowlistedWhitelistedToTransferHold: null,
		transferable: null,
		selfCustody: null,
		stablecoin: null,
		governance: null,
		trueRWA: false,
		suspicious: false,
		suspiciousReason: null,
		onChainMcap: null,
		activeMcap: null,
		defiActiveTvl: null,
		...overrides
	}
}

const assets: IRWAAssetsOverview['assets'] = [
	createSpotAsset({ id: '1', category: ['Treasuries'], parentPlatform: 'Centrifuge' }),
	createSpotAsset({
		id: '2',
		canonicalMarketId: 'superstate/ustb',
		detailHref: '/rwa/asset/superstate%2Fustb',
		ticker: 'BBB',
		assetName: 'Beta',
		category: ['Private Credit'],
		parentPlatform: 'Maple'
	})
]

function DatasetProbe({
	mode,
	chartAssets = assets,
	initialDataset = { source: [], dimensions: ['timestamp'] },
	initialOpenInterestDataset = null,
	selectedMetric = 'onChainMcap',
	includeStablecoins = false,
	includeGovernance = false,
	includeRwaPerps = false,
	includeCex = false,
	useInitialDataset = false
}: {
	mode: RWAChartAggregationMode
	chartAssets?: IRWAAssetsOverview['assets']
	initialDataset?: RWAPositionalChartDataset
	initialOpenInterestDataset?: { source: RWAChartRow[]; dimensions: string[] } | null
	selectedMetric?: 'onChainMcap' | 'activeMcap' | 'defiActiveTvl'
	includeStablecoins?: boolean
	includeGovernance?: boolean
	includeRwaPerps?: boolean
	includeCex?: boolean
	useInitialDataset?: boolean
}) {
	const { chartDataset, chartError } = useRwaChartDataset({
		selectedMetric,
		initialDataset,
		initialOpenInterestDataset,
		filteredAssets: chartAssets,
		mode,
		target: { kind: 'all' },
		includeStablecoins,
		includeGovernance,
		includeRwaPerps,
		includeCex,
		useInitialDataset
	})

	return React.createElement(
		'pre',
		null,
		`${chartDataset.dimensions.join('|')};${chartError ?? ''};${JSON.stringify(chartDataset)}`
	)
}

function AssetGroupProbe({
	enabled,
	chartAssets,
	metric
}: {
	enabled: boolean
	chartAssets: IRWAAssetsOverview['assets']
	metric: RWAChartMetricKey
}) {
	const result = useRwaAssetGroupPieChartData({ enabled, assets: chartAssets, metric })
	return React.createElement('script', {
		type: 'application/json',
		dangerouslySetInnerHTML: { __html: JSON.stringify(result) }
	})
}

function CategoryProbe({
	enabled,
	chartAssets,
	categories,
	selectedCategories,
	metric
}: {
	enabled: boolean
	chartAssets: IRWAAssetsOverview['assets']
	categories: string[]
	selectedCategories: string[]
	metric: RWAChartMetricKey
}) {
	const result = useRWAAssetCategoryPieChartData({
		enabled,
		assets: chartAssets,
		categories,
		selectedCategories,
		metric
	})
	return React.createElement('script', {
		type: 'application/json',
		dangerouslySetInnerHTML: { __html: JSON.stringify(result) }
	})
}

function FilteredAssetsProbe({
	chartAssets,
	includeRwaPerps,
	includeCex = false,
	hasPerpsOverlayBlockingFilters = false,
	selectedCategoryOverride
}: {
	chartAssets: IRWAAssetsOverview['assets']
	includeRwaPerps: boolean
	includeCex?: boolean
	hasPerpsOverlayBlockingFilters?: boolean
	selectedCategoryOverride?: string[]
}) {
	const selectedCategories = Array.from(new Set(chartAssets.flatMap((asset) => asset.category ?? [])))
	const selectedPlatforms = Array.from(
		new Set(chartAssets.flatMap((asset) => (asset.parentPlatform ? [asset.parentPlatform] : [])))
	)
	const selectedAssetGroups = Array.from(new Set(chartAssets.map((asset) => normalizeRwaAssetGroup(asset.assetGroup))))
	const selectedAccessModels = Array.from(
		new Set(chartAssets.flatMap((asset) => (asset.accessModel ? [asset.accessModel] : [])))
	)
	const selectedIssuers = Array.from(new Set(chartAssets.map((asset) => asset.issuer || 'Unknown')))

	const result = useFilteredRwaAssets({
		assets: chartAssets,
		isPlatformMode: false,
		selectedAssetNames: [],
		selectedTypes: ['Unknown', 'Perp'],
		selectedCategories: selectedCategoryOverride ?? selectedCategories,
		selectedPlatforms,
		selectedAssetGroups,
		selectedAssetClasses: [],
		selectedRwaClassifications: [],
		selectedAccessModels,
		selectedIssuers,
		selectedRedeemableStates: ['yes', 'no', 'unknown'],
		selectedAttestationsStates: ['yes', 'no', 'unknown'],
		selectedCexListedStates: ['yes', 'no', 'unknown'],
		selectedKycForMintRedeemStates: ['yes', 'no', 'unknown'],
		selectedKycAllowlistedWhitelistedToTransferHoldStates: ['yes', 'no', 'unknown'],
		selectedTransferableStates: ['yes', 'no', 'unknown'],
		selectedSelfCustodyStates: ['yes', 'no', 'unknown'],
		includeStablecoins: true,
		includeGovernance: true,
		includeRwaPerps,
		includeCex,
		hasPerpsOverlayBlockingFilters,
		minDefiActiveTvlToOnChainMcapPct: null,
		maxDefiActiveTvlToOnChainMcapPct: null,
		minActiveMcapToOnChainMcapPct: null,
		maxActiveMcapToOnChainMcapPct: null,
		minDefiActiveTvlToActiveMcapPct: null,
		maxDefiActiveTvlToActiveMcapPct: null
	})

	return React.createElement('script', {
		type: 'application/json',
		dangerouslySetInnerHTML: {
			__html: JSON.stringify({
				kinds: result.filteredAssets.map((asset) => asset.kind),
				totalOpenInterest: result.totalOpenInterest
			})
		}
	})
}

function readJsonMarkup(markup: string) {
	const match = markup.match(/<script type="application\/json">([\s\S]*)<\/script>/)
	const json = match?.[1]
	if (!json) throw new Error('Expected JSON script markup')
	return JSON.parse(json)
}

describe('useRwaChartDataset', () => {
	beforeEach(() => {
		useQueryMock.mockReset()
		fetchJsonMock.mockReset()
		useQueryMock.mockImplementation((options: { queryKey: unknown[] }) => {
			if (options.queryKey[0] === 'rwa-perps-open-interest-chart') {
				return {
					data: {
						source: [{ timestamp: 1, 'xyz:alpha': 20, 'xyz:beta': 10 }],
						dimensions: ['timestamp', 'xyz:alpha', 'xyz:beta']
					},
					isLoading: false,
					error: null
				}
			}

			return {
				data: [{ timestamp: 1, 'ondo/usdy': 100, 'superstate/ustb': 80 }],
				isLoading: false,
				error: null
			}
		})
		fetchJsonMock.mockResolvedValue([{ timestamp: 1, 'ondo/usdy': 100, 'superstate/ustb': 80 }])
	})

	it('regroups cached ticker rows without changing the fetch key', () => {
		const categoryMarkup = renderToStaticMarkup(React.createElement(DatasetProbe, { mode: 'category' }))
		const platformMarkup = renderToStaticMarkup(React.createElement(DatasetProbe, { mode: 'platform' }))
		const totalMarkup = renderToStaticMarkup(React.createElement(DatasetProbe, { mode: 'total' }))

		expect(categoryMarkup).toContain('timestamp|Total Onchain Mcap|Treasuries|Private Credit')
		expect(platformMarkup).toContain('timestamp|Total Onchain Mcap|Centrifuge|Maple')
		expect(totalMarkup).toContain('timestamp|Total Onchain Mcap')
		expect(useQueryMock).toHaveBeenCalledTimes(6)
		expect(getUseQueryOptions(0)).toMatchObject({
			queryKey: getRwaAssetChartQueryKey({ kind: 'all' }, 'onChainMcap', false, false, true)
		})
		expect(getUseQueryOptions(1)).toMatchObject({
			queryKey: getRwaOpenInterestChartQueryKey(false),
			enabled: false
		})
		expect(getUseQueryOptions(2)).toMatchObject({
			queryKey: getRwaAssetChartQueryKey({ kind: 'all' }, 'onChainMcap', false, false, true)
		})
	})

	it('changes the fetch key when inclusion flags change', () => {
		renderToStaticMarkup(React.createElement(DatasetProbe, { mode: 'category', includeStablecoins: false }))
		renderToStaticMarkup(React.createElement(DatasetProbe, { mode: 'category', includeStablecoins: true }))

		expect(getUseQueryOptions(0)).toMatchObject({
			queryKey: getRwaAssetChartQueryKey({ kind: 'all' }, 'onChainMcap', false, false, true)
		})
		expect(getUseQueryOptions(1)).toMatchObject({
			queryKey: getRwaOpenInterestChartQueryKey(false),
			enabled: false
		})
		expect(getUseQueryOptions(2)).toMatchObject({
			queryKey: getRwaAssetChartQueryKey({ kind: 'all' }, 'onChainMcap', true, false, true)
		})
	})

	it('uses the primary category when regrouping category chart rows', () => {
		const multiCategoryAssets: IRWAAssetsOverview['assets'] = [
			createSpotAsset({
				category: ['Treasuries', 'Private Credit'],
				parentPlatform: 'Centrifuge'
			})
		]

		useQueryMock.mockReturnValueOnce({
			data: [{ timestamp: 1, 'ondo/usdy': 100 }],
			isLoading: false,
			error: null
		})

		const markup = renderToStaticMarkup(
			React.createElement(DatasetProbe, { mode: 'category', chartAssets: multiCategoryAssets })
		)

		expect(markup).toContain('timestamp|Total Onchain Mcap|Treasuries')
		expect(markup).not.toContain('Private Credit')
	})

	it('passes the resolved inclusion flags to the asset-breakdown fetcher', async () => {
		let capturedOptions: { queryFn: () => Promise<unknown> } | undefined
		useQueryMock.mockImplementation((options: { queryKey: unknown[]; queryFn: () => Promise<unknown> }) => {
			if (options.queryKey[0] === 'rwa-asset-chart') {
				capturedOptions = options
			}
			return {
				data: undefined,
				isLoading: false,
				error: null
			}
		})

		renderToStaticMarkup(
			React.createElement(DatasetProbe, {
				mode: 'category',
				includeStablecoins: true,
				includeGovernance: false
			})
		)

		if (!capturedOptions) throw new Error('Expected the asset chart query options')
		await capturedOptions.queryFn()

		expect(fetchJsonMock).toHaveBeenCalledWith(
			'/api/public/rwa/asset-breakdown?key=onChainMcap&includeStablecoin=true&includeGovernance=false&includeBridgeTvl=true'
		)
	})

	it('returns the prerendered dataset when runtime fetching is disabled', () => {
		useQueryMock.mockReturnValue({
			data: undefined,
			isLoading: false,
			error: null
		})

		const markup = renderToStaticMarkup(
			React.createElement(DatasetProbe, {
				mode: 'category',
				initialDataset: {
					source: [[1, 100, 100]],
					dimensions: ['timestamp', 'Total Onchain Mcap', 'Prerendered']
				},
				useInitialDataset: true
			})
		)

		expect(markup).toContain('timestamp|Total Onchain Mcap|Prerendered')
		expect(useQueryMock).toHaveBeenCalledTimes(2)
		expect(getUseQueryOptions(0)).toMatchObject({
			queryKey: getRwaAssetChartQueryKey({ kind: 'all' }, 'onChainMcap', false, false, true),
			enabled: false
		})
		expect(getUseQueryOptions(1)).toMatchObject({
			queryKey: getRwaOpenInterestChartQueryKey(false),
			enabled: false
		})
	})

	it('uses the prerendered RWA Perps OI dataset without runtime fetching in the default state', () => {
		useQueryMock.mockImplementation((options: { queryKey: unknown[] }) => ({
			data: undefined,
			isLoading: false,
			error: null,
			queryKey: options.queryKey
		}))

		const markup = renderToStaticMarkup(
			React.createElement(DatasetProbe, {
				mode: 'category',
				chartAssets: [createSpotAsset(), createPerpsAsset()],
				initialDataset: {
					source: [[1, 100, 100]],
					dimensions: ['timestamp', 'Total Active Mcap', 'Treasuries']
				},
				initialOpenInterestDataset: {
					source: [{ timestamp: 1, 'RWA Perps OI': 25 }],
					dimensions: ['timestamp', 'RWA Perps OI']
				},
				selectedMetric: 'activeMcap',
				includeRwaPerps: true,
				useInitialDataset: true
			})
		)

		expect(markup).toContain('timestamp|Total Active Mcap|Treasuries|RWA Perps OI')
		expect(useQueryMock).toHaveBeenCalledTimes(2)
		expect(getUseQueryOptions(0)).toMatchObject({
			queryKey: getRwaAssetChartQueryKey({ kind: 'all' }, 'activeMcap', false, false, true),
			enabled: false
		})
		expect(getUseQueryOptions(1)).toMatchObject({
			queryKey: getRwaOpenInterestChartQueryKey(false),
			enabled: false
		})
	})

	it('ignores cached errors from disabled queries while using complete prerendered data', () => {
		useQueryMock.mockReturnValue({
			data: undefined,
			isLoading: false,
			error: new Error('stale cached error')
		})

		const markup = renderToStaticMarkup(
			React.createElement(DatasetProbe, {
				mode: 'category',
				chartAssets: [createSpotAsset(), createPerpsAsset()],
				initialDataset: {
					source: [[1, 100, 100]],
					dimensions: ['timestamp', 'Total Active Mcap', 'Treasuries']
				},
				initialOpenInterestDataset: {
					source: [{ timestamp: 1, 'RWA Perps OI': 25 }],
					dimensions: ['timestamp', 'RWA Perps OI']
				},
				selectedMetric: 'activeMcap',
				includeRwaPerps: true,
				useInitialDataset: true
			})
		)

		expect(markup).toContain('timestamp|Total Active Mcap|Treasuries|RWA Perps OI')
		expect(markup).not.toContain('stale cached error')
	})

	it('retries a missing prerendered RWA Perps OI dataset without refetching the spot dataset', () => {
		useQueryMock.mockImplementation((options: { queryKey: unknown[] }) => ({
			data:
				options.queryKey[0] === getRwaOpenInterestChartQueryKey(false)[0]
					? {
							source: [{ timestamp: 1, 'xyz:alpha': 25 }],
							dimensions: ['timestamp', 'xyz:alpha']
						}
					: undefined,
			isLoading: false,
			error: null
		}))

		const markup = renderToStaticMarkup(
			React.createElement(DatasetProbe, {
				mode: 'category',
				chartAssets: [createSpotAsset(), createPerpsAsset({ contract: 'xyz:alpha' })],
				initialDataset: {
					source: [[1, 100, 100]],
					dimensions: ['timestamp', 'Total Active Mcap', 'Treasuries']
				},
				initialOpenInterestDataset: null,
				selectedMetric: 'activeMcap',
				includeRwaPerps: true,
				useInitialDataset: true
			})
		)

		expect(markup).toContain('timestamp|Total Active Mcap|Treasuries|RWA Perps OI')
		expect(getUseQueryOptions(0)).toMatchObject({ enabled: false })
		expect(getUseQueryOptions(1)).toMatchObject({
			queryKey: getRwaOpenInterestChartQueryKey(false),
			enabled: true
		})
	})

	it('switches OI venue scope without refetching spot history or reusing the wrong preloaded line', async () => {
		useQueryMock.mockImplementation((options: { queryKey: unknown[] }) => ({
			data:
				options.queryKey[0] === 'rwa-perps-open-interest-chart'
					? {
							source: [{ timestamp: 1, 'xyz:alpha': 100, 'binance:ALPHA': 200 }],
							dimensions: ['timestamp', 'xyz:alpha', 'binance:ALPHA']
						}
					: undefined,
			isLoading: false,
			error: null
		}))
		const dex = createPerpsAsset()
		const cex = createPerpsAsset({ id: 'binance:alpha', contract: 'binance:ALPHA', venueType: 'CEX' })
		for (const includeCex of [false, true, false]) {
			useQueryMock.mockClear()
			const markup = renderToStaticMarkup(
				<DatasetProbe
					mode="category"
					chartAssets={[createSpotAsset(), dex, ...(includeCex ? [cex] : [])]}
					initialDataset={{ source: [[1, 50, 50]], dimensions: ['timestamp', 'Total Active Mcap', 'Treasuries'] }}
					initialOpenInterestDataset={{
						source: [{ timestamp: 1, 'RWA Perps OI': 100 }],
						dimensions: ['timestamp', 'RWA Perps OI']
					}}
					selectedMetric="activeMcap"
					includeRwaPerps
					includeCex={includeCex}
					useInitialDataset
				/>
			)
			expect(markup).toContain('[1,50,50]')
			expect(markup).toContain(`[1,${includeCex ? 300 : 100}]`)
			expect(getUseQueryOptions(0)).toMatchObject({ enabled: false })
			expect(getUseQueryOptions(1)).toMatchObject({
				queryKey: getRwaOpenInterestChartQueryKey(includeCex),
				enabled: includeCex
			})
			await useQueryMock.mock.calls[1][0].queryFn()
			expect(fetchJsonMock).toHaveBeenLastCalledWith(
				`/api/public/rwa/perps/contract-breakdown?key=openInterest${includeCex ? '&includeCex=true' : ''}`
			)
		}
	})

	it('reports a failed CEX history request instead of showing the preloaded DEX total', () => {
		useQueryMock.mockReturnValue({ data: undefined, isLoading: false, error: new Error('CEX history unavailable') })
		const markup = renderToStaticMarkup(
			<DatasetProbe
				mode="category"
				chartAssets={[createSpotAsset(), createPerpsAsset()]}
				initialDataset={{ source: [[1, 50, 50]], dimensions: ['timestamp', 'Total Active Mcap', 'Treasuries'] }}
				initialOpenInterestDataset={{
					source: [{ timestamp: 1, 'RWA Perps OI': 100 }],
					dimensions: ['timestamp', 'RWA Perps OI']
				}}
				includeRwaPerps
				includeCex
				useInitialDataset
			/>
		)
		expect(markup).toContain('CEX history unavailable')
		expect(markup).not.toContain('RWA Perps OI')
	})

	it('does not display a preloaded OI line when filters exclude all perps', () => {
		const markup = renderToStaticMarkup(
			<DatasetProbe
				mode="category"
				chartAssets={[createSpotAsset()]}
				initialOpenInterestDataset={{
					source: [{ timestamp: 1, 'RWA Perps OI': 100 }],
					dimensions: ['timestamp', 'RWA Perps OI']
				}}
				includeRwaPerps
				useInitialDataset
			/>
		)
		expect(markup).not.toContain('RWA Perps OI')
		expect(getUseQueryOptions(1)).toMatchObject({ enabled: false })
	})

	it('reuses the prerendered dataset for Total by projecting the hidden Total column', () => {
		useQueryMock.mockReturnValue({
			data: undefined,
			isLoading: false,
			error: null
		})

		const markup = renderToStaticMarkup(
			React.createElement(DatasetProbe, {
				mode: 'total',
				initialDataset: {
					source: [[1, 100, 100]],
					dimensions: ['timestamp', 'Total Onchain Mcap', 'Treasuries']
				},
				useInitialDataset: true
			})
		)

		expect(markup).toContain('timestamp|Total Onchain Mcap')
		expect(useQueryMock).toHaveBeenCalledTimes(2)
		expect(getUseQueryOptions(0)).toMatchObject({
			queryKey: getRwaAssetChartQueryKey({ kind: 'all' }, 'onChainMcap', false, false, true),
			enabled: false
		})
		expect(getUseQueryOptions(1)).toMatchObject({
			queryKey: getRwaOpenInterestChartQueryKey(false),
			enabled: false
		})
	})

	it('overlays filtered RWA Perps OI on the selected chart metric', () => {
		const markup = renderToStaticMarkup(
			React.createElement(DatasetProbe, {
				mode: 'category',
				chartAssets: [
					createSpotAsset({
						onChainMcap: { total: 100, breakdown: [] },
						category: ['Treasuries'],
						parentPlatform: 'Centrifuge'
					}),
					createPerpsAsset({ contract: 'xyz:alpha', category: ['Treasuries'], parentPlatform: 'Centrifuge' })
				],
				selectedMetric: 'defiActiveTvl',
				includeRwaPerps: true
			})
		)

		expect(markup).toContain('timestamp|Total DeFi Active TVL|Treasuries|RWA Perps OI')
		expect(getUseQueryOptions(0)).toMatchObject({
			queryKey: getRwaAssetChartQueryKey({ kind: 'all' }, 'defiActiveTvl', false, false, true),
			enabled: true
		})
		expect(getUseQueryOptions(1)).toMatchObject({
			queryKey: getRwaOpenInterestChartQueryKey(false),
			enabled: true
		})
	})
})

describe('resolveRWAOverviewInclusionFlag', () => {
	it('uses the page default when the query param is absent', () => {
		expect(resolveRWAOverviewInclusionFlag(undefined, true)).toBe(true)
		expect(resolveRWAOverviewInclusionFlag(undefined, false)).toBe(false)
	})

	it('lets an explicit false query override a true page default', () => {
		expect(resolveRWAOverviewInclusionFlag('false', true)).toBe(false)
		expect(resolveRWAOverviewInclusionFlag('true', false)).toBe(true)
	})
})

describe('hasActiveChartFilters', () => {
	it('ignores inclusion params that resolve to the current defaults', () => {
		expect(hasActiveChartFilters({ includeStablecoins: 'true' }, DEFAULT_ALL_INCLUSION)).toBe(false)
		expect(hasActiveChartFilters({ includeGovernance: 'true' }, DEFAULT_ALL_INCLUSION)).toBe(false)
		expect(hasActiveChartFilters({ includeStablecoins: 'true' }, DEFAULT_STABLECOIN_INCLUSION)).toBe(false)
		expect(hasActiveChartFilters({ includeStablecoins: 'false' }, DEFAULT_INCLUSION)).toBe(false)
		expect(hasActiveChartFilters({ includeRwaPerps: 'false' }, DEFAULT_INCLUSION)).toBe(false)
		expect(hasActiveChartFilters({ includeCex: 'true' }, DEFAULT_INCLUSION)).toBe(false)
	})

	it('treats inclusion params as active when they override the current defaults', () => {
		expect(hasActiveChartFilters({ includeStablecoins: 'false' }, DEFAULT_ALL_INCLUSION)).toBe(true)
		expect(hasActiveChartFilters({ includeGovernance: 'false' }, DEFAULT_ALL_INCLUSION)).toBe(true)
		expect(hasActiveChartFilters({ includeStablecoins: 'false' }, DEFAULT_STABLECOIN_INCLUSION)).toBe(true)
		expect(hasActiveChartFilters({ includeStablecoins: 'true' }, DEFAULT_INCLUSION)).toBe(true)
	})

	it('still treats non-inclusion query filters as active', () => {
		expect(hasActiveChartFilters({ minActiveMcapToOnChainMcapPct: '10' }, DEFAULT_ALL_INCLUSION)).toBe(true)
	})

	it('treats the bridge toggle as an active chart filter', () => {
		expect(hasActiveChartFilters({ includeBridgeTvl: 'false' }, DEFAULT_INCLUSION)).toBe(true)
	})
})

describe('useFilteredRwaAssets', () => {
	it('filters perps rows when the RWA Perps toggle is disabled', () => {
		const chartAssets: IRWAAssetsOverview['assets'] = [
			createSpotAsset({ onChainMcap: { total: 100, breakdown: [] } }),
			createPerpsAsset()
		]

		expect(
			readJsonMarkup(
				renderToStaticMarkup(React.createElement(FilteredAssetsProbe, { chartAssets, includeRwaPerps: true }))
			)
		).toEqual({ kinds: ['spot', 'perps'], totalOpenInterest: 1 })
		expect(
			readJsonMarkup(
				renderToStaticMarkup(React.createElement(FilteredAssetsProbe, { chartAssets, includeRwaPerps: false }))
			)
		).toEqual({ kinds: ['spot'], totalOpenInterest: 0 })
	})

	it('applies shared category filters to perps overlay rows', () => {
		const chartAssets: IRWAAssetsOverview['assets'] = [
			createSpotAsset({ category: ['Treasuries'] }),
			createPerpsAsset({ category: ['Treasuries'], openInterest: 5 }),
			createPerpsAsset({ id: 'perps-2', contract: 'xyz:beta', category: ['Commodities'], openInterest: 7 })
		]

		expect(
			readJsonMarkup(
				renderToStaticMarkup(
					React.createElement(FilteredAssetsProbe, {
						chartAssets,
						includeRwaPerps: true,
						selectedCategoryOverride: ['Treasuries']
					})
				)
			)
		).toEqual({ kinds: ['spot', 'perps'], totalOpenInterest: 5 })
	})

	it('hides perps overlay rows when asset-only filters are active', () => {
		const chartAssets: IRWAAssetsOverview['assets'] = [
			createSpotAsset({ onChainMcap: { total: 100, breakdown: [] } }),
			createPerpsAsset({ openInterest: 5 })
		]

		expect(
			readJsonMarkup(
				renderToStaticMarkup(
					React.createElement(FilteredAssetsProbe, {
						chartAssets,
						includeRwaPerps: true,
						hasPerpsOverlayBlockingFilters: true
					})
				)
			)
		).toEqual({ kinds: ['spot'], totalOpenInterest: 0 })
	})
})

describe('useRwaAssetGroupPieChartData', () => {
	const metricCases: Array<{ metric: RWAChartMetricKey; expected: Array<{ name: string; value: number }> }> = [
		{
			metric: 'onChainMcap',
			expected: [
				{ name: 'Stablecoins', value: 100 },
				{ name: 'Unknown', value: 50 }
			]
		},
		{
			metric: 'activeMcap',
			expected: [
				{ name: 'Stablecoins', value: 90 },
				{ name: 'Unknown', value: 20 }
			]
		},
		{
			metric: 'defiActiveTvl',
			expected: [
				{ name: 'Stablecoins', value: 30 },
				{ name: 'Unknown', value: 10 }
			]
		}
	]

	it.each(metricCases)('groups only the selected $metric values and keeps Unknown', ({ metric, expected }) => {
		const chartAssets: IRWAAssetsOverview['assets'] = [
			createSpotAsset({
				assetGroup: 'Stablecoins',
				category: ['Treasuries'],
				parentPlatform: 'Centrifuge',
				onChainMcap: { total: 100, breakdown: [] },
				activeMcap: { total: 90, breakdown: [] },
				defiActiveTvl: { total: 30, breakdown: [] }
			}),
			createSpotAsset({
				id: '2',
				canonicalMarketId: 'superstate/ustb',
				detailHref: '/rwa/asset/superstate%2Fustb',
				ticker: 'BBB',
				assetName: 'Beta',
				category: ['Private Credit'],
				parentPlatform: 'Maple',
				onChainMcap: { total: 50, breakdown: [] },
				activeMcap: { total: 20, breakdown: [] },
				defiActiveTvl: { total: 10, breakdown: [] }
			})
		]

		const data = readJsonMarkup(
			renderToStaticMarkup(React.createElement(AssetGroupProbe, { enabled: true, chartAssets, metric }))
		)
		expect(data.pieChartData).toEqual(expected)
		expect(Object.keys(data)).toEqual(['pieChartData', 'pieChartStackColors'])
	})

	it('returns empty data when disabled', () => {
		const data = readJsonMarkup(
			renderToStaticMarkup(
				React.createElement(AssetGroupProbe, { enabled: false, chartAssets: assets, metric: 'onChainMcap' })
			)
		)
		expect(data).toEqual({ pieChartData: [], pieChartStackColors: {} })
	})
})

describe('useRWAAssetCategoryPieChartData', () => {
	it('attributes category totals only to the primary category', () => {
		const chartAssets: IRWAAssetsOverview['assets'] = [
			createSpotAsset({
				category: ['Treasuries', 'Private Credit'],
				parentPlatform: 'Centrifuge',
				onChainMcap: { total: 100, breakdown: [] },
				activeMcap: { total: 90, breakdown: [] },
				defiActiveTvl: { total: 30, breakdown: [] }
			})
		]

		const data = readJsonMarkup(
			renderToStaticMarkup(
				React.createElement(CategoryProbe, {
					enabled: true,
					chartAssets,
					categories: ['Treasuries', 'Private Credit'],
					selectedCategories: ['Treasuries', 'Private Credit'],
					metric: 'activeMcap'
				})
			)
		)

		expect(data.pieChartData).toEqual([{ name: 'Treasuries', value: 90 }])
	})
})
