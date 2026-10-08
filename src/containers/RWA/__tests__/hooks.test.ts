// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, test, vi } from 'vitest'
import type { MultiSeriesTimeSeriesDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { IRWAAssetsOverview } from '../api.types'
import {
	buildRwaBreakdownSlices,
	buildRwaChartDataset,
	hasRwaInclusionOverrides,
	resolveRWAOverviewInclusionFlag,
	useRwaChartDataset
} from '../hooks'

const { fetchJsonMock } = vi.hoisted(() => ({ fetchJsonMock: vi.fn() }))

vi.mock('~/utils/async', async (importOriginal) => ({
	...(await importOriginal<typeof import('~/utils/async')>()),
	fetchJson: fetchJsonMock
}))

const DEFAULT_INCLUSION = { includeStablecoins: false, includeGovernance: false, includeRwaPerps: false }
const DEFAULT_ALL_INCLUSION = { includeStablecoins: true, includeGovernance: true, includeRwaPerps: false }
const DEFAULT_STABLECOIN_INCLUSION = { ...DEFAULT_INCLUSION, includeStablecoins: true }

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
		priceChange24h: null,
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

const assetRows = [{ timestamp: 1, 'ondo/usdy': 100, 'superstate/ustb': 80 }]

function chartDataset(overrides: Partial<Parameters<typeof buildRwaChartDataset>[0]> = {}) {
	return buildRwaChartDataset({
		useInitialDataset: false,
		initialDataset: { source: [], dimensions: ['timestamp'] },
		assetRows,
		filteredAssets: assets,
		mode: 'category',
		selectedMetric: 'onChainMcap',
		...overrides
	})
}

describe('buildRwaChartDataset', () => {
	test('regroups the same per-asset rows by category, platform or total', () => {
		expect(chartDataset({ mode: 'category' })).toEqual({
			dimensions: ['timestamp', 'Total Onchain AUM', 'Treasuries', 'Private Credit'],
			source: [[1, 180, 100, 80]]
		})
		expect(chartDataset({ mode: 'platform' }).dimensions).toEqual([
			'timestamp',
			'Total Onchain AUM',
			'Centrifuge',
			'Maple'
		])
		expect(chartDataset({ mode: 'total' }).dimensions).toEqual(['timestamp', 'Total Onchain AUM'])
	})

	test('uses the primary category when regrouping category chart rows', () => {
		const dataset = chartDataset({
			assetRows: [{ timestamp: 1, 'ondo/usdy': 100 }],
			filteredAssets: [createSpotAsset({ category: ['Treasuries', 'Private Credit'], parentPlatform: 'Centrifuge' })]
		})

		expect(dataset.dimensions).toEqual(['timestamp', 'Total Onchain AUM', 'Treasuries'])
	})

	test('returns the prerendered dataset when the page uses it', () => {
		const initialDataset: MultiSeriesTimeSeriesDataset = {
			source: [[1, 100, 100]],
			dimensions: ['timestamp', 'Total Onchain AUM', 'Prerendered']
		}

		expect(chartDataset({ useInitialDataset: true, initialDataset, assetRows: undefined })).toEqual(initialDataset)
	})

	test('projects the hidden Total column of the prerendered dataset for Total', () => {
		expect(
			chartDataset({
				mode: 'total',
				useInitialDataset: true,
				initialDataset: {
					source: [[1, 150, 100, 50]],
					dimensions: ['timestamp', 'Total Onchain AUM', 'Treasuries', 'Private Credit']
				},
				assetRows: undefined
			})
		).toEqual({ source: [[1, 150]], dimensions: ['timestamp', 'Total Onchain AUM'] })
	})

	test('never carries an open interest line in the spot dataset, perps rows or not', () => {
		const dataset = chartDataset({
			selectedMetric: 'defiActiveTvl',
			filteredAssets: [
				createSpotAsset({
					onChainMcap: { total: 100, breakdown: [] },
					category: ['Treasuries'],
					parentPlatform: 'Centrifuge'
				}),
				createPerpsAsset({ contract: 'xyz:alpha', category: ['Treasuries'], parentPlatform: 'Centrifuge' })
			]
		})

		expect(dataset.dimensions).toEqual(['timestamp', 'Total DeFi Active TVL', 'Treasuries'])
	})

	test('is empty until the per-asset rows arrive', () => {
		expect(chartDataset({ assetRows: undefined })).toEqual({ source: [], dimensions: ['timestamp'] })
	})
})

describe('asset chart fetching', () => {
	test('refetches the rows when an inclusion flag toggles instead of serving the cached ones', async () => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		fetchJsonMock.mockReset()
		fetchJsonMock.mockImplementation(async (url: string) =>
			url.includes('includeGovernance=true')
				? [{ timestamp: 1, 'ondo/usdy': 100, 'superstate/ustb': 80 }]
				: [{ timestamp: 1, 'ondo/usdy': 10, 'superstate/ustb': 8 }]
		)
		const results: Array<ReturnType<typeof useRwaChartDataset>> = []
		function Probe({ includeGovernance }: { includeGovernance: boolean }) {
			results.push(
				useRwaChartDataset({
					selectedMetric: 'onChainMcap',
					initialDataset: null,
					filteredAssets: assets,
					mode: 'total',
					target: { kind: 'all' },
					includeStablecoins: false,
					includeGovernance,
					useInitialDataset: false
				})
			)
			return null
		}
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
		const root = createRoot(document.createElement('div'))
		const render = (includeGovernance: boolean) =>
			act(async () =>
				root.render(createElement(QueryClientProvider, { client }, createElement(Probe, { includeGovernance })))
			)

		await render(false)
		await waitForUi(() => expect(results.at(-1)?.chartDataset.source).toEqual([[1, 18]]))
		await render(true)
		await waitForUi(() => expect(results.at(-1)?.chartDataset.source).toEqual([[1, 180]]))

		await act(async () => root.unmount())
		client.clear()
	})
})

describe('resolveRWAOverviewInclusionFlag', () => {
	test('uses the page default when the query param is absent', () => {
		expect(resolveRWAOverviewInclusionFlag(undefined, true)).toBe(true)
		expect(resolveRWAOverviewInclusionFlag(undefined, false)).toBe(false)
	})

	test('lets an explicit false query override a true page default', () => {
		expect(resolveRWAOverviewInclusionFlag('false', true)).toBe(false)
		expect(resolveRWAOverviewInclusionFlag('true', false)).toBe(true)
	})
})

describe('hasRwaInclusionOverrides', () => {
	test('ignores inclusion params that resolve to the current defaults', () => {
		expect(hasRwaInclusionOverrides({ includeStablecoins: 'true' }, DEFAULT_ALL_INCLUSION)).toBe(false)
		expect(hasRwaInclusionOverrides({ includeGovernance: 'true' }, DEFAULT_ALL_INCLUSION)).toBe(false)
		expect(hasRwaInclusionOverrides({ includeStablecoins: 'true' }, DEFAULT_STABLECOIN_INCLUSION)).toBe(false)
		expect(hasRwaInclusionOverrides({ includeStablecoins: 'false' }, DEFAULT_INCLUSION)).toBe(false)
		expect(hasRwaInclusionOverrides({ includeRwaPerps: 'false' }, DEFAULT_INCLUSION)).toBe(false)
		expect(hasRwaInclusionOverrides({ includeCex: 'true' }, DEFAULT_INCLUSION)).toBe(false)
	})

	test('treats inclusion params as active when they override the current defaults', () => {
		expect(hasRwaInclusionOverrides({ includeStablecoins: 'false' }, DEFAULT_ALL_INCLUSION)).toBe(true)
		expect(hasRwaInclusionOverrides({ includeGovernance: 'false' }, DEFAULT_ALL_INCLUSION)).toBe(true)
		expect(hasRwaInclusionOverrides({ includeStablecoins: 'false' }, DEFAULT_STABLECOIN_INCLUSION)).toBe(true)
		expect(hasRwaInclusionOverrides({ includeStablecoins: 'true' }, DEFAULT_INCLUSION)).toBe(true)
		expect(hasRwaInclusionOverrides({ includeBridgeTvl: 'false' }, DEFAULT_INCLUSION)).toBe(true)
	})
})

describe('buildRwaBreakdownSlices', () => {
	const slices = (overrides: Partial<Parameters<typeof buildRwaBreakdownSlices>[0]>) =>
		buildRwaBreakdownSlices({
			axis: 'assetGroup',
			assets: [],
			metric: 'activeMcap',
			selectedCategories: [],
			includeBridgeTvl: true,
			...overrides
		})

	const groupAssets: IRWAAssetsOverview['assets'] = [
		createSpotAsset({
			assetGroup: 'Stablecoins',
			onChainMcap: { total: 100, breakdown: [] },
			activeMcap: { total: 90, breakdown: [] },
			defiActiveTvl: { total: 30, breakdown: [] }
		}),
		createSpotAsset({
			id: '2',
			onChainMcap: { total: 50, breakdown: [] },
			activeMcap: { total: 20, breakdown: [] },
			defiActiveTvl: { total: 10, breakdown: [] }
		})
	]

	test.each([
		{ metric: 'onChainMcap', stablecoins: 100, unknown: 50 },
		{ metric: 'activeMcap', stablecoins: 90, unknown: 20 },
		{ metric: 'defiActiveTvl', stablecoins: 30, unknown: 10 }
	] as const)('groups only the selected $metric values and keeps Unknown', ({ metric, stablecoins, unknown }) => {
		expect(slices({ axis: 'assetGroup', assets: groupAssets, metric })).toEqual([
			{ name: 'Stablecoins', value: stablecoins },
			{ name: 'Unknown', value: unknown }
		])
	})

	test('attributes category totals only to the primary category', () => {
		const data = slices({
			axis: 'category',
			assets: [
				createSpotAsset({
					category: ['Treasuries', 'Private Credit'],
					onChainMcap: { total: 100, breakdown: [] },
					activeMcap: { total: 90, breakdown: [] }
				})
			],
			selectedCategories: ['Treasuries', 'Private Credit']
		})

		expect(data).toEqual([{ name: 'Treasuries', value: 90 }])
	})

	test('leaves out categories the user deselected', () => {
		const data = slices({
			axis: 'category',
			assets: [
				createSpotAsset({ category: ['Treasuries'], activeMcap: { total: 90, breakdown: [] } }),
				createSpotAsset({ id: '2', category: ['Private Credit'], activeMcap: { total: 40, breakdown: [] } })
			],
			selectedCategories: ['Private Credit']
		})

		expect(data).toEqual([{ name: 'Private Credit', value: 40 }])
	})

	test('merges platforms that differ only in case or spacing and names the missing one Unknown', () => {
		const data = slices({
			axis: 'platform',
			assets: [
				createSpotAsset({ parentPlatform: 'Ondo', activeMcap: { total: 50, breakdown: [] } }),
				createSpotAsset({ id: '2', parentPlatform: ' ondo ', activeMcap: { total: 30, breakdown: [] } }),
				createSpotAsset({ id: '3', parentPlatform: null, activeMcap: { total: 100, breakdown: [] } }),
				createSpotAsset({ id: '4', parentPlatform: 'Maple', activeMcap: { total: 0, breakdown: [] } })
			]
		})

		expect(data).toEqual([
			{ name: 'Unknown', value: 100 },
			{ name: 'Ondo', value: 80 }
		])
	})

	test("sums each chain from the assets' per-chain breakdown of the selected metric", () => {
		const data = slices({
			axis: 'chain',
			metric: 'onChainMcap',
			assets: [
				createSpotAsset({
					onChainMcap: {
						total: 70,
						breakdown: [
							['Ethereum', 50],
							['Solana', 20]
						]
					},
					activeMcap: { total: 900, breakdown: [['Solana', 900]] }
				}),
				createSpotAsset({ id: '2', onChainMcap: { total: 30, breakdown: [['ethereum', 30]] } })
			]
		})

		expect(data).toEqual([
			{ name: 'Ethereum', value: 80 },
			{ name: 'Solana', value: 20 }
		])
	})

	test('under one slice per asset draws every asset of the page, largest first', () => {
		const data = slices({
			axis: 'assetName',
			assets: [
				createSpotAsset({ assetName: 'Alpha', activeMcap: { total: 10, breakdown: [] } }),
				createSpotAsset({ id: '2', assetName: '', ticker: 'BBB', activeMcap: { total: 40, breakdown: [] } }),
				createSpotAsset({ id: '3', assetName: 'Alpha', activeMcap: { total: 5, breakdown: [] } })
			]
		})

		expect(data).toEqual([
			{ name: 'BBB', value: 40 },
			{ name: 'Alpha', value: 15 }
		])
	})
})
