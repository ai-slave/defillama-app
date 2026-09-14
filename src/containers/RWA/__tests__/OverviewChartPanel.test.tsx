import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import type { IRWAAssetsOverview } from '../api.types'
import { RWA_CHART_FILTER_NOTE } from '../chartBreakdown'
import { getRankedRwaFilterValues } from '../rankedFilterValues'
import { perpsAsset, spotAsset } from '../table/__tests__/fixtures'

let routerQuery: Record<string, string | Array<string>> = {}

vi.mock('next/router', () => ({
	useRouter: () => ({ query: routerQuery, pathname: '/rwa', asPath: '/rwa', push: vi.fn(), replace: vi.fn() })
}))

import { RWAOverviewChartPanel, type RWAOverviewChartPanelProps } from '../OverviewChartPanel'

const assets = [
	spotAsset(),
	spotAsset({ id: 'buidl', canonicalMarketId: 'securitize/buidl', assetName: 'BUIDL' }),
	perpsAsset()
]

function overview(overrides: Partial<IRWAAssetsOverview> = {}): IRWAAssetsOverview {
	return {
		platformPage: null,
		platformAssetSummary: null,
		assets,
		typeOptions: [],
		assetClassOptions: [],
		rwaClassificationOptions: [],
		accessModelOptions: [],
		categoriesOptions: [],
		platforms: ['Ondo', 'Securitize'],
		assetGroups: ['Bonds'],
		assetNames: ['Ondo USDY', 'BUIDL'],
		issuers: ['Ondo'],
		platformLinks: [],
		selectedPlatform: 'All',
		assetGroupLinks: [],
		selectedAssetGroup: 'All',
		defaultInclusion: {
			includeStablecoins: false,
			includeGovernance: false,
			includeRwaPerps: false,
			includeBridgeTvl: true
		},
		chainLinks: [{ label: 'All', to: '/rwa' }],
		selectedChain: 'All',
		categoryLinks: [],
		selectedCategory: 'All',
		totals: {
			onChainMcap: 0,
			activeMcap: 0,
			defiActiveTvl: 0,
			issuers: [],
			stablecoins: { onChainMcap: 0, activeMcap: 0, defiActiveTvl: 0, issuers: [] },
			governance: { onChainMcap: 0, activeMcap: 0, defiActiveTvl: 0, issuers: [] },
			stablecoinsAndGovernance: { onChainMcap: 0, activeMcap: 0, defiActiveTvl: 0, issuers: [] }
		},
		initialChartDatasets: [],
		cards: null,
		chartMetricAvailability: { hasActiveMcapData: true },
		seriesLatestTimestamp: 1_800_000_000_000,
		platformLogos: {},
		chainSlug: null,
		categorySlug: null,
		platformSlug: null,
		assetGroupSlug: null,
		...overrides
	}
}

function render(query: Record<string, string | Array<string>>, props: Partial<RWAOverviewChartPanelProps> = {}) {
	routerQuery = query
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
	const page = overview()
	const full: RWAOverviewChartPanelProps = {
		overview: page,
		mode: 'chain',
		selectedModeLabel: 'All',
		aggregateAssets: page.assets,
		view: 'assets',
		groupBy: 'chain',
		rankedFilterValues: getRankedRwaFilterValues({
			typeOptions: [],
			categoriesOptions: [],
			assetClassOptions: [],
			rwaClassificationOptions: [],
			accessModelOptions: []
		}),
		selectedAssetNames: [],
		selectedCategories: [],
		includeStablecoins: false,
		includeGovernance: false,
		includeCex: true,
		includeBridgeTvl: true,
		activeFilters: false,
		activeAttributeFilters: false,
		...props
	}
	return renderToStaticMarkup(
		<QueryClientProvider client={client}>
			<RWAOverviewChartPanel {...full} />
		</QueryClientProvider>
	)
}

describe('RWAOverviewChartPanel', () => {
	test('offers the four asset metrics and the five views, with no breakdown dropdown', () => {
		const markup = render({})
		for (const label of ['Active Mcap', 'Onchain Mcap', 'DeFi Active TVL', 'Net Flows']) expect(markup).toContain(label)
		expect(markup).toContain('Time Series Chart')
		expect(markup).not.toContain('Asset Platform')
		expect(markup).not.toContain('>Chain<')
	})

	test('offers Open Interest and Volume in the Perps view and reads the metric from chartType', () => {
		const oi = render({}, { view: 'perps', groupBy: 'platform' })
		expect(oi).toContain('Open Interest')
		expect(oi).toContain('Volume')
		expect(oi).not.toContain('Active Mcap')
		expect(oi).not.toContain('Volume period')
		const volume = render({ chartType: 'volume' }, { view: 'perps', groupBy: 'platform' })
		expect(volume).toContain('Volume period')
	})

	test('falls back to the time series when the view has no share or pie for the metric', () => {
		expect(render({ chartView: 'share' }, { view: 'perps', groupBy: 'platform' })).toContain('Share Chart')
		expect(render({ chartView: 'pie' }, { view: 'perps', groupBy: 'platform' })).toContain('Time Series Chart')
		expect(render({ chartType: 'volume', chartView: 'share' }, { view: 'perps', groupBy: 'platform' })).toContain(
			'Time Series Chart'
		)
	})

	test('shows the split note only where a server split is drawn under attribute filters', () => {
		expect(render({ chartType: 'flows' }, { activeAttributeFilters: true })).toContain(RWA_CHART_FILTER_NOTE)
		expect(render({}, { view: 'perps', groupBy: 'platform', activeAttributeFilters: true })).toContain(
			RWA_CHART_FILTER_NOTE
		)
		expect(render({}, { activeAttributeFilters: true })).not.toContain(RWA_CHART_FILTER_NOTE)
		expect(render({ chartType: 'flows' })).not.toContain(RWA_CHART_FILTER_NOTE)
	})

	test('hides the flow overlays when the flows follow a grouping and keeps them for the total', () => {
		expect(render({ chartType: 'flows' }, { groupBy: 'chain' })).not.toContain('Overlays')
		expect(render({ chartType: 'flows' }, { groupBy: 'none' })).toContain('Overlays')
	})

	test('hands the pie, treemap and bar views to the breakdown panel', () => {
		const pie = render({ chartView: 'pie' }, { groupBy: 'assetGroup' })
		expect(pie).toContain('Pie Chart')
		expect(pie).not.toContain('Nested by')
		const treemap = render({ chartView: 'treemap' }, { groupBy: 'assetGroup' })
		expect(treemap).toContain('Treemap Chart')
		expect(treemap).toContain('Nested by: No Grouping')
	})

	test('renders nothing for a page with one asset and no flows', () => {
		routerQuery = {}
		const client = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
		const page = overview({ assets: [spotAsset()] })
		const markup = renderToStaticMarkup(
			<QueryClientProvider client={client}>
				<RWAOverviewChartPanel
					overview={page}
					mode="chain"
					selectedModeLabel="All"
					aggregateAssets={page.assets}
					view="assets"
					groupBy="chain"
					rankedFilterValues={getRankedRwaFilterValues({
						typeOptions: [],
						categoriesOptions: [],
						assetClassOptions: [],
						rwaClassificationOptions: [],
						accessModelOptions: []
					})}
					selectedAssetNames={[]}
					selectedCategories={[]}
					includeStablecoins={false}
					includeGovernance={false}
					includeCex
					includeBridgeTvl
					activeFilters={false}
					activeAttributeFilters={false}
				/>
			</QueryClientProvider>
		)
		expect(markup).toBe('')
	})
})
