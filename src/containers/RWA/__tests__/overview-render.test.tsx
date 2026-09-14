import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import type { IRWAAssetsOverview } from '../api.types'
import { RWA_CHART_FILTER_NOTE } from '../chartBreakdown'
import { definitions } from '../definitions'
import { perpsAsset, spotAsset } from '../table/__tests__/fixtures'

let routerQuery: Record<string, string | Array<string>> = {}

vi.mock('next/router', () => ({
	useRouter: () => ({ query: routerQuery, pathname: '/rwa', asPath: '/rwa', push: vi.fn(), replace: vi.fn() })
}))

import { RWAOverview } from '../index'

function overviewProps(overrides: Partial<IRWAAssetsOverview> = {}): IRWAAssetsOverview {
	const assets = [
		spotAsset(),
		spotAsset({
			id: 'buidl',
			canonicalMarketId: 'securitize/buidl',
			assetName: 'BUIDL',
			ticker: 'BUIDL',
			parentPlatform: 'Securitize',
			issuer: 'BlackRock'
		}),
		perpsAsset()
	]
	return {
		platformPage: null,
		platformAssetSummary: null,
		assets,
		typeOptions: [
			{ key: 'Asset', name: 'Asset' },
			{ key: 'Perp', name: 'Perp' }
		],
		assetClassOptions: [
			{ key: 'Bonds', name: 'Bonds' },
			{ key: 'Bond Perp', name: 'Bond Perp' }
		],
		rwaClassificationOptions: [{ key: 'RWA', name: 'RWA' }],
		accessModelOptions: [
			{ key: 'Permissioned', name: 'Permissioned' },
			{ key: 'Permissionless', name: 'Permissionless' }
		],
		categoriesOptions: [{ key: 'Treasuries', name: 'Treasuries' }],
		platforms: ['Ondo', 'Securitize', 'Hyperliquid'],
		assetGroups: ['Bonds'],
		assetNames: ['Ondo USDY', 'BUIDL'],
		issuers: ['Ondo', 'BlackRock'],
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
		platformLogos: { ondo: 'https://icons.llamao.fi/icons/rwa/ondo.png' },
		chainSlug: null,
		categorySlug: null,
		platformSlug: null,
		assetGroupSlug: null,
		...overrides
	}
}

function render(props: IRWAAssetsOverview, query: Record<string, string | Array<string>> = {}) {
	routerQuery = query
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
	return renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(RWAOverview, props)))
}

describe('RWAOverview page composition', () => {
	test('renders the strip, tiles, grouped table and highlights in the assets view', () => {
		const markup = render(overviewProps())
		expect(markup).toContain('Assets Rankings')
		expect(markup).toContain('Group by: Platform')
		expect(markup).toContain('href="/rwa/platform/ondo"')
		expect(markup).toContain('Change period')
		expect(markup).toContain('Include in TVL')
		expect(markup.split('List Your Assets').length - 1).toBe(2)
		expect(markup).not.toContain('value="includeRwaPerps"')
		expect(markup).toContain(definitions.totalActiveMcap.label)
		expect(markup).toContain('Key Metrics')
		expect(markup).not.toContain(definitions.totalAssetIssuers.label)
		expect(markup).toContain('+14.29%')
		expect(markup).toContain('Movers 7d')
		expect(markup).toContain('New listings')
		expect(markup).not.toContain('USDY Perp')
	})

	test('groups by platform with logos when asked', () => {
		const markup = render(overviewProps(), { groupBy: 'platform' })
		expect(markup).toContain('Group by: Platform')
		expect(markup).toContain('href="/rwa/platform/ondo"')
		expect(markup).toContain('icons/rwa/ondo.png')
		expect(markup).toContain('href="/rwa/platform/securitize"')
	})

	test('opens the perps view from the perps key', () => {
		const markup = render(overviewProps(), { perps: 'true' })
		expect(markup).toContain('Perps Rankings')
		expect(markup).toContain('Group by: Venue')
		expect(markup).toContain('href="/rwa/perps/venue/hyperliquid"')
	})

	test('switches the table to perps rows with the perps columns and OI tile, the old key still read', () => {
		const markup = render(overviewProps(), { includeRwaPerps: 'true', groupBy: 'none' })
		expect(markup).toContain('Perps Rankings')
		expect(markup).toContain('Group by: None')
		expect(markup).toContain('CEX Perps')
		expect(markup).toContain('USDY Perp')
		expect(markup).toContain('Open Interest')
		expect(markup).toContain('RWA Perps OI')
		expect(markup).not.toContain('Movers 7d')
	})

	test('falls back to platform grouping for a group by the view does not support', () => {
		const markup = render(overviewProps(), { includeRwaPerps: 'true', groupBy: 'chain' })
		expect(markup).toContain('Group by: Venue')
	})

	test('draws the chart by the table Group by and ignores the old breakdown keys', () => {
		const markup = render(overviewProps(), {
			timeSeriesChartBreakdown: 'assetName',
			nonTimeSeriesChartBreakdown: 'chain'
		})
		expect(markup).toContain('Group by: Platform')
		expect(markup).toContain('Time Series Chart')
		expect(markup).not.toContain('Asset Name')
		expect(markup).not.toContain('Asset Platform')
	})

	test('offers the share view and keeps the pie on the same axis as the table', () => {
		expect(render(overviewProps(), { chartView: 'share' })).toContain('Share Chart')
		const pie = render(overviewProps(), { groupBy: 'assetGroup', chartView: 'pie' })
		expect(pie).toContain('Group by: Asset Group')
		expect(pie).toContain('Pie Chart')
		expect(pie).not.toContain('>Asset Group<')
	})

	test('hides the Chain grouping on a chain page and opens it by platform', () => {
		const markup = render(overviewProps({ selectedChain: 'Ethereum', chainSlug: 'ethereum' }))
		expect(markup).toContain('Group by: Platform')
		expect(markup).not.toContain('>Chain<')
	})

	test('notes that a server split cannot follow the attribute filters', () => {
		expect(render(overviewProps(), { chartType: 'flows', platforms: 'Ondo' })).toContain(RWA_CHART_FILTER_NOTE)
		expect(render(overviewProps(), { chartType: 'flows' })).not.toContain(RWA_CHART_FILTER_NOTE)
		expect(render(overviewProps(), { platforms: 'Ondo' })).not.toContain(RWA_CHART_FILTER_NOTE)
	})
})
