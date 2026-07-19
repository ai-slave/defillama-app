// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChartConfiguration } from '~/containers/LlamaAI/types'

vi.mock('~/auth', () => ({ useAuthContext: () => ({}) }))
vi.mock('~/containers/LlamaAI/components/AddToArticle/ArticleExportContext', () => ({
	useArticleExport: () => null
}))
vi.mock('~/hooks/useGetChartInstance', () => ({
	useGetChartInstance: () => ({ chartInstance: () => null, handleChartReady: () => undefined })
}))
vi.mock('~/components/ECharts/CandlestickChart', () => ({ default: () => <div data-testid="candlestick" /> }))

import { ChartRenderer } from './ChartRenderer'

function makeChart(id: string): ChartConfiguration {
	return {
		id,
		type: 'candlestick',
		title: id.toUpperCase(),
		description: '',
		axes: {
			x: { field: 'timestamp', label: 'Date', type: 'time' },
			yAxes: [{ id: 'price', fields: ['price'], label: 'Price', position: 'left' }]
		},
		series: [
			{
				name: 'Price',
				type: 'candlestick',
				yAxisId: 'price',
				metricClass: 'stock',
				dataMapping: { xField: 'timestamp', yField: 'price' },
				styling: {}
			}
		],
		dataTransformation: { timeField: 'timestamp', metrics: ['open', 'high', 'low', 'close'] }
	}
}

describe('ChartRenderer chart selection', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		vi.stubGlobal(
			'ResizeObserver',
			class {
				disconnect() {}
				observe() {}
			}
		)
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		if (container.childNodes.length > 0) await act(async () => root.unmount())
		container.remove()
		vi.unstubAllGlobals()
	})

	it('keeps the selected chart active across reorder and falls back after removal', async () => {
		const chartA = makeChart('a')
		const chartB = makeChart('b')
		const chartC = makeChart('c')
		const getActiveChartId = () => container.querySelector('[data-chart-id]')?.getAttribute('data-chart-id')

		await act(async () => root.render(<ChartRenderer charts={[chartA, chartB, chartC]} chartData={[]} />))
		const chartCButton = [...container.querySelectorAll('button')].find((button) => button.textContent === 'C')
		if (!chartCButton) throw new Error('Expected chart C tab')
		await act(async () => chartCButton.dispatchEvent(new MouseEvent('click', { bubbles: true })))

		expect(getActiveChartId()).toBe('c')

		await act(async () => root.render(<ChartRenderer charts={[chartC, chartA, chartB]} chartData={[]} />))
		expect(getActiveChartId()).toBe('c')

		await act(async () => root.render(<ChartRenderer charts={[chartA, chartB]} chartData={[]} />))
		expect(getActiveChartId()).toBe('a')

		await act(async () => root.render(<ChartRenderer charts={[chartB, chartA]} chartData={[]} />))
		expect(getActiveChartId()).toBe('a')
	})
})
