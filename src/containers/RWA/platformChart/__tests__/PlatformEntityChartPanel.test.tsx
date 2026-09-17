import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import type { IRWAAssetsOverview } from '../../api.types'
import type { RWAPlatformMeta } from '../../PlatformPage/api.types'
import { spotAsset } from '../../table/__tests__/fixtures'

let routerQuery: Record<string, string | Array<string>> = {}
const push = vi.fn()

vi.mock('next/router', () => ({
	useRouter: () => ({
		query: routerQuery,
		pathname: '/rwa/platform/[platform]',
		asPath: '/rwa/platform/ondo',
		push,
		replace: vi.fn()
	})
}))

import { RWAPlatformEntityChartPanel } from '../PlatformEntityChartPanel'

const assets = [spotAsset(), spotAsset({ id: 'b', canonicalMarketId: 'b', assetName: 'Beta' })]

const meta = {
	name: 'Ondo',
	slug: 'ondo',
	milestones: [{ date: '2026-05', event: 'FINRA approval' }]
} as unknown as RWAPlatformMeta

function overview(): IRWAAssetsOverview {
	return {
		platformPage: { meta },
		assets,
		typeOptions: [],
		assetClassOptions: [],
		rwaClassificationOptions: [],
		accessModelOptions: [],
		categoriesOptions: [],
		platforms: ['Ondo'],
		assetGroups: ['Bonds'],
		assetNames: ['Ondo USDY', 'Beta'],
		issuers: ['Ondo'],
		platformLinks: [],
		selectedPlatform: 'Ondo',
		assetGroupLinks: [],
		selectedAssetGroup: 'All',
		defaultInclusion: {
			includeStablecoins: false,
			includeGovernance: false,
			includeRwaPerps: false,
			includeBridgeTvl: true
		},
		chainLinks: [],
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
		initialChartDatasets: [
			{
				metric: 'activeMcap',
				groupBy: 'none',
				dataset: {
					dimensions: ['timestamp', 'Total Active AUM', 'Ondo USDY', 'Beta'],
					source: [[1_700_000_000_000, 30, 20, 10]]
				}
			}
		],
		cards: null,
		chartMetricAvailability: { hasActiveMcapData: true },
		seriesLatestTimestamp: 1_800_000_000_000,
		platformLogos: {},
		chainSlug: null,
		categorySlug: null,
		platformSlug: 'ondo',
		assetGroupSlug: null
	}
}

function render(query: Record<string, string | Array<string>>) {
	routerQuery = query
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
	const page = overview()
	return renderToStaticMarkup(
		<QueryClientProvider client={client}>
			<RWAPlatformEntityChartPanel
				overview={page}
				meta={meta}
				aggregateAssets={page.assets}
				includeStablecoins={false}
				includeGovernance={false}
				includeBridgeTvl
				activeFilters={false}
			/>
		</QueryClientProvider>
	)
}

describe('RWAPlatformEntityChartPanel', () => {
	test('opens with one chip, Active AUM, and the Add Metrics button', () => {
		const markup = render({})
		expect(markup).toContain('Add Metrics')
		expect(markup.match(/type="checkbox"/g)).toHaveLength(1)
		expect(markup).toContain('Active AUM')
		expect(markup).not.toContain('Net Flows')
	})

	test('reads the selection from ?metrics= and shows a chip per metric', () => {
		const markup = render({ metrics: 'activeMcap,netFlows,events' })
		expect(markup.match(/type="checkbox"/g)).toHaveLength(3)
		expect(markup).toContain('Net Flows')
		expect(markup).toContain('Events')
	})

	test('offers the daily to yearly period control and the exports', () => {
		const markup = render({})
		for (const short of ['D', 'W', 'M', 'Q', 'Y']) expect(markup).toContain(`>${short}<`)
		expect(markup).toContain('.csv')
		expect(markup).toContain('.png')
	})
})
