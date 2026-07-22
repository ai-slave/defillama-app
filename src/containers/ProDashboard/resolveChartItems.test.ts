import { describe, expect, it, vi } from 'vitest'
import { createDashboardChartResolutionCache, resolveDashboardChartItems } from './resolveChartItems'
import type { ChartConfig, DashboardItemConfig } from './types'

function chart(index: number): ChartConfig {
	return { id: `chart-${index}`, kind: 'chart', chain: 'Ethereum', type: 'tvl' }
}

describe('resolveDashboardChartItems', () => {
	it('preserves every unchanged item identity when one of 36 sources updates', () => {
		const items = Array.from({ length: 36 }, (_, index) => chart(index))
		const chartIndexById = new Map(items.map((item, index) => [item.id, index]))
		const refetch = vi.fn()
		const queries = items.map((_, index) => ({ data: [[index, index]] as [number, number][], refetch }))
		const cache = createDashboardChartResolutionCache()
		const first = resolveDashboardChartItems({ items, chartIndexById, chartQueries: queries, streamDone: true, cache })
		const nextQueries = queries.slice()
		nextQueries[17] = { data: [[17, 99]], refetch }

		const second = resolveDashboardChartItems({
			items,
			chartIndexById,
			chartQueries: nextQueries,
			streamDone: true,
			cache
		})

		expect(second[17]).not.toBe(first[17])
		for (let index = 0; index < items.length; index++) {
			if (index !== 17) expect(second[index]).toBe(first[index])
		}
	})

	it('keeps non-chart items and unchanged multi-chart children stable', () => {
		const firstChart = chart(1)
		const secondChart = chart(2)
		const text: DashboardItemConfig = { id: 'text', kind: 'text', content: 'Summary' }
		const multi: DashboardItemConfig = { id: 'multi', kind: 'multi', items: [firstChart, secondChart] }
		const items = [text, multi]
		const chartIndexById = new Map([
			[firstChart.id, 0],
			[secondChart.id, 1]
		])
		const queries = [{ data: [[1, 1]] as [number, number][] }, { data: [[1, 2]] as [number, number][] }]
		const cache = createDashboardChartResolutionCache()
		const first = resolveDashboardChartItems({ items, chartIndexById, chartQueries: queries, streamDone: true, cache })
		const second = resolveDashboardChartItems({ items, chartIndexById, chartQueries: queries, streamDone: true, cache })

		expect(second[0]).toBe(text)
		expect(second[1]).toBe(first[1])
	})
})
