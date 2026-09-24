// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, createContext } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
import type { ArticleChartConfig } from '../types'

const DAY = 86_400
const POINTS: Array<[number, number]> = [
	[1_767_225_600, 1200],
	[1_767_225_600 + DAY, 1500]
]

type ChartProps = { valueSymbol: string; charts: Array<{ name: string; valueSymbol?: string }> }
const chartRenders: Array<ChartProps> = []
vi.mock('~/components/ECharts/MultiSeriesChart', () => ({
	default: (props: ChartProps) => {
		chartRenders.push(props)
		return null
	}
}))
vi.mock('~/containers/ProDashboard/queries', () => ({
	ProxyAuthTokenContext: createContext<string | null>(null),
	useProtocolsAndChains: () => ({ data: undefined }),
	getChartQueryFn: () => async () => POINTS,
	filterDataByTimePeriod: (data: Array<[number, number]>) => data
}))

import { ArticleChartBlock } from '../renderer/ArticleChartBlock'

async function render(config: ArticleChartConfig) {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	chartRenders.length = 0
	const container = document.createElement('div')
	const root = createRoot(container)
	await act(async () =>
		root.render(
			<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
				<ArticleChartBlock config={config} />
			</QueryClientProvider>
		)
	)
	await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
	return { container, chart: chartRenders.at(-1)!, unmount: () => act(async () => root.unmount()) }
}

const series = (chartType: string) => ({ entityType: 'chain' as const, slug: 'ethereum', name: 'Ethereum', chartType })

test('shows a count metric without a dollar sign', async () => {
	const { container, chart, unmount } = await render({ series: [series('txs')], entities: [], chartType: 'txs' })

	expect(chart.valueSymbol).toBe('')
	expect(chart.charts.map((entry) => entry.valueSymbol)).toEqual([''])
	expect(container.textContent).toContain('Latest1,500')
	expect(container.textContent).not.toContain('$')
	expect(container.textContent).not.toContain('USD-denominated')
	await unmount()
})

test('gives each metric its own unit when a chart mixes them', async () => {
	const { container, chart, unmount } = await render({
		series: [series('tvl'), series('txs')],
		entities: [],
		chartType: 'tvl'
	})

	expect(chart.charts.map((entry) => entry.valueSymbol)).toEqual(['$', ''])
	expect(container.textContent).not.toContain('USD-denominated')
	await unmount()
})

test('keeps dollar labels for a USD metric', async () => {
	const { container, chart, unmount } = await render({ series: [series('tvl')], entities: [], chartType: 'tvl' })

	expect(chart.valueSymbol).toBe('$')
	expect(container.textContent).toContain('Latest$1.5K')
	expect(container.textContent).toContain('USD-denominated')
	await unmount()
})
