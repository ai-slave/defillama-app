// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
import type { ChartRuntimeView } from '../../../chartRuntime'
import { CombinedChartPreview } from '../CombinedChartPreview'
import { SeparateChartsPreview } from '../SeparateChartsPreview'

const seriesNames: Array<Array<string>> = []
vi.mock('~/components/ECharts/MultiSeriesChart', () => ({
	default: ({ charts }: { charts: Array<{ name: string }> }) => {
		seriesNames.push(charts.map((chart) => chart.name))
		return null
	}
}))
vi.mock('../../../ProDashboardAPIContext', () => ({
	useProDashboardCatalog: () => ({ getProtocolInfo: () => undefined })
}))

const item = (type: string, grouping: ChartRuntimeView['grouping']) =>
	({
		id: type,
		kind: 'chart',
		subjectType: 'chain',
		chain: 'Ethereum',
		type,
		grouping,
		data: [[1_789_516_800, 40]],
		isLoading: false
	}) as ChartRuntimeView

async function render(element: React.ReactElement) {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	seriesNames.length = 0
	const container = document.createElement('div')
	const root = createRoot(container)
	await act(async () => root.render(element))
	await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
	return { container, unmount: () => act(async () => root.unmount()) }
}

test('names grouped active addresses as a daily average in the combined preview', async () => {
	const { unmount } = await render(
		<CombinedChartPreview composerItems={[item('activeUsers', 'week'), item('txs', 'week')]} />
	)

	expect(seriesNames.at(-1)).toEqual(['Ethereum Active Addresses (daily average)', 'Ethereum Transactions'])
	await unmount()
})

test('names grouped active addresses as a daily average in the separate previews, and daily ones plainly', async () => {
	const { container, unmount } = await render(
		<SeparateChartsPreview composerItems={[item('activeUsers', 'month'), item('activeUsers', 'day')]} />
	)

	expect(seriesNames).toEqual([['Ethereum Active Addresses (daily average)'], ['Ethereum Active Addresses']])
	expect(container.textContent).toContain('Ethereum Active Addresses (daily average)')
	await unmount()
})
