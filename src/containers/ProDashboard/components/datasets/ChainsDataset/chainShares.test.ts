// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, test, vi } from 'vitest'
import type { ChainsDatasetRow } from '~/containers/ChainsByCategory/types'
import { getProChainsDatasetQueryKey } from '~/containers/ProDashboard/tableQueryKeys'
import { buildChainShareTotals, getChainMetricShare } from './chainShares'
import { ChainsDataset } from './index'

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/pro/test', query: {}, push: vi.fn() }) }))

function chain(name: string, totalFees24h: number | null): ChainsDatasetRow {
	return {
		name,
		icon: '',
		protocols: 0,
		deprecated: false,
		users: null,
		change_1d: null,
		change_7d: null,
		change_1m: null,
		tvl: 1,
		stablesMcap: null,
		totalVolume24h: null,
		totalVolume7d: null,
		totalVolume30d: null,
		totalFees24h,
		totalFees7d: null,
		totalFees30d: null,
		totalRevenue24h: null,
		totalRevenue7d: null,
		totalRevenue30d: null,
		totalAppRevenue24h: null,
		totalAppRevenue7d: null,
		totalAppRevenue30d: null,
		bridgedTvl: null,
		mcaptvl: null,
		mcap: null,
		symbol: null,
		extraTvl: null
	}
}

// The rows come from the query cache the dashboard stream fills.
async function renderChains(rows: Array<ChainsDatasetRow>) {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	const client = new QueryClient()
	client.setQueryData(getProChainsDatasetQueryKey(undefined), rows)
	const container = document.createElement('div')
	document.body.appendChild(container)
	const root = createRoot(container)
	await act(async () =>
		root.render(
			createElement(
				QueryClientProvider,
				{ client },
				createElement(ChainsDataset, {
					columnOrder: ['name', 'totalFees24h_share'],
					columnVisibility: { name: true, totalFees24h_share: true }
				})
			)
		)
	)
	return {
		clickShareHeader: () =>
			act(async () =>
				Array.from(container.querySelectorAll('th button'))
					.find((button) => button.textContent?.includes('24h Fees % Share'))!
					.dispatchEvent(new MouseEvent('click', { bubbles: true }))
			),
		shareCells: () =>
			Array.from(container.querySelectorAll('tbody tr'), (row) =>
				Array.from(row.querySelectorAll('td'), (cell) => cell.textContent?.trim())
					.slice(0, 2)
					.join(' ')
			),
		unmount: async () => {
			await act(async () => root.unmount())
			container.remove()
			client.clear()
		}
	}
}

describe('chain metric shares', () => {
	test('sorts signed shares with missing values last in both directions', async () => {
		const table = await renderChains([
			chain('Positive', 100),
			chain('Unknown', null),
			chain('Zero', 0),
			chain('Adjustment', -20)
		])
		await table.clickShareHeader()
		const descending = table.shareCells()
		await table.clickShareHeader()
		const ascending = table.shareCells()
		await table.unmount()

		expect(descending).toEqual(['Positive 125.00%', 'Zero 0.00%', 'Adjustment -25.00%', 'Unknown -'])
		expect(ascending).toEqual(['Adjustment -25.00%', 'Zero 0.00%', 'Positive 125.00%', 'Unknown -'])
	})

	test('uses the algebraic canonical total so signed contributions sum to 100%', () => {
		const totals = buildChainShareTotals([chain('Positive', 100), chain('Adjustment', -20), chain('Unknown', null)])

		expect(totals.totalFees24h).toBe(80)
		expect(getChainMetricShare(100, totals.totalFees24h)).toBe(125)
		expect(getChainMetricShare(-20, totals.totalFees24h)).toBe(-25)
	})

	test('preserves measured zero and keeps null or non-positive denominators unavailable', () => {
		expect(getChainMetricShare(0, 10)).toBe(0)
		expect(getChainMetricShare(null, 10)).toBeNull()
		expect(getChainMetricShare(0, 0)).toBeNull()
		expect(getChainMetricShare(-1, -1)).toBeNull()
	})
})
