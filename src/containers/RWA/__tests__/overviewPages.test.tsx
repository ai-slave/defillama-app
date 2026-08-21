import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IRWAChainsOverviewRow, RWAStatsSegmented } from '../api.types'
import type { RWAPositionalChartDataset } from '../chartDataset'

let routerQuery: Record<string, string | string[]> = {}
let lastTableData: Array<Record<string, unknown>> | null = null
let lastCsvFileName: string | null = null

vi.mock('next/router', () => ({
	useRouter: () => ({ query: routerQuery })
}))

vi.mock('~/components/Table/TableWithSearch', () => ({
	TableWithSearch: ({ data, csvFileName }: { data: Array<Record<string, unknown>>; csvFileName: string }) => {
		lastTableData = data
		lastCsvFileName = csvFileName
		return null
	}
}))

vi.mock('../OverviewBreakdownChart', () => ({
	RWAOverviewBreakdownChart: () => null
}))

import { RWAAssetGroups } from '../AssetGroups'
import { RWACategories } from '../Categories'
import { RWAChains } from '../Chains'
import { RWAPlatforms } from '../Platforms'

function renderAll(element: ReactElement) {
	return renderToStaticMarkup(element)
}

function slice(overrides: Partial<RWAStatsSegmented['base']> = {}): RWAStatsSegmented['base'] {
	return {
		onChainMcap: 0,
		activeMcap: 0,
		defiActiveTvl: 0,
		bridgeTvl: 0,
		assetCount: 0,
		assetIssuers: [],
		...overrides
	}
}

const segmented: RWAStatsSegmented = {
	base: slice({
		onChainMcap: 500,
		activeMcap: 400,
		defiActiveTvl: 100,
		bridgeTvl: 30,
		assetCount: 2,
		assetIssuers: ['a']
	}),
	stablecoinsOnly: slice(),
	governanceOnly: slice(),
	stablecoinsAndGovernance: slice()
}

const chainRow: IRWAChainsOverviewRow = { ...segmented, chain: 'Ethereum' }
const emptyChartDataset: RWAPositionalChartDataset = { source: [], dimensions: ['timestamp'] }

beforeEach(() => {
	routerQuery = {}
	lastTableData = null
	lastCsvFileName = null
})

describe('RWA overview pages bridge/interop toggle', () => {
	it('renders the toggle and keeps bridge TVL in the totals by default', () => {
		const html = renderAll(
			createElement(RWAChains, {
				chains: [chainRow],
				initialChartDataset: emptyChartDataset,
				page: { kind: 'chain' }
			})
		)

		expect(html).toContain('Bridge/Interop TVL')
		expect(lastTableData?.[0]).toMatchObject({ chain: 'Ethereum', totalDefiActiveTvl: 100 })
		expect(lastCsvFileName).toBe('rwa-chains')
	})

	it('subtracts bridge TVL from the chains table when the toggle is off', () => {
		routerQuery = { includeBridgeTvl: 'false' }

		renderAll(
			createElement(RWAChains, {
				chains: [chainRow],
				initialChartDataset: emptyChartDataset,
				page: { kind: 'chain' }
			})
		)

		expect(lastTableData?.[0]).toMatchObject({ totalDefiActiveTvl: 70 })
		expect(lastCsvFileName).toBe('rwa-chains-without-bridge-tvl')
	})

	it('subtracts bridge TVL on categories, platforms and asset groups', () => {
		routerQuery = { includeBridgeTvl: 'false' }

		for (const [element, name] of [
			[
				createElement(RWACategories, {
					categories: [{ ...segmented, category: 'Treasuries' }],
					initialChartDataset: emptyChartDataset,
					page: { kind: 'category' }
				}),
				'rwa-categories-without-bridge-tvl'
			],
			[
				createElement(RWAPlatforms, {
					platforms: [{ ...segmented, platform: 'Securitize' }],
					initialChartDataset: emptyChartDataset
				}),
				'rwa-platforms-without-bridge-tvl'
			],
			[
				createElement(RWAAssetGroups, {
					assetGroups: [{ ...segmented, assetGroup: 'Treasury Bills' }],
					initialChartDataset: emptyChartDataset,
					page: { kind: 'assetGroup' }
				}),
				'rwa-asset-groups-without-bridge-tvl'
			]
		] as Array<[ReactElement, string]>) {
			const html = renderAll(element)

			expect(html).toContain('Bridge/Interop TVL')
			expect(lastTableData?.[0]).toMatchObject({ defiActiveTvl: 70 })
			expect(lastCsvFileName).toBe(name)
		}
	})
})
