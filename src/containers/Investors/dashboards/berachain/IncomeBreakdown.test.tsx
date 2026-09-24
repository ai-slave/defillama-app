// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
import type { BerachainIncomeServerData } from './api'

// Aug 1 to Sep 9, 2026: forty daily points across two months.
const DAYS = Array.from({ length: 40 }, (_, index) => Date.UTC(2026, 7, 1 + index) / 1000)
const daily = (value: number): Array<[number, number]> => DAYS.map((day) => [day, value])
const serverData: BerachainIncomeServerData = {
	chainFees: daily(1),
	bexRevenue: daily(2),
	bexVolume: daily(3),
	bendFees: daily(4),
	bendRevenue: daily(5)
}

const chartRenders: Array<{ rows: number; groupBy: unknown }> = []
vi.mock('~/components/ECharts/MultiSeriesChart', () => ({
	default: (props: { dataset: { source: Array<unknown> }; groupBy?: unknown }) => {
		chartRenders.push({ rows: props.dataset.source.length, groupBy: props.groupBy })
		return null
	}
}))
vi.mock('~/containers/Investors/CustomServerDataContext', () => ({ useCustomServerData: () => serverData }))
vi.mock('./api', async (importOriginal) => ({
	...(await importOriginal<typeof import('./api')>()),
	useHoneyRevenueData: () => ({ data: undefined, isLoading: true })
}))

import IncomeBreakdown from './IncomeBreakdown'

test('labels each monthly breakdown by its month, and the daily cumulative charts by their day', async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	const root = createRoot(document.createElement('div'))
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<IncomeBreakdown />
			</QueryClientProvider>
		)
	)

	const monthly = chartRenders.filter((chartRender) => chartRender.rows === 2)
	const cumulative = chartRenders.filter((chartRender) => chartRender.rows === DAYS.length)
	// Chain fees, BEX and BEND each have one monthly breakdown.
	expect(monthly.map((chartRender) => chartRender.groupBy)).toEqual(['monthly', 'monthly', 'monthly'])
	expect(cumulative.length).toBeGreaterThan(0)
	expect(new Set(cumulative.map((chartRender) => chartRender.groupBy))).toEqual(new Set([undefined]))
	await act(async () => root.unmount())
})
