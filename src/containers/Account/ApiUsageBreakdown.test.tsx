// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'

const mocks = vi.hoisted(() => ({ chartProps: null as IMultiSeriesChartProps | null }))

vi.mock('~/components/ECharts/MultiSeriesChart', () => ({
	default: (props: IMultiSeriesChartProps) => {
		mocks.chartProps = props
		return <div data-testid="api-usage-chart" />
	}
}))

import { ApiUsageBreakdown } from './ApiUsageBreakdown'

describe('ApiUsageBreakdown', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		mocks.chartProps = null
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	it('passes positional rows and numeric encodes to MultiSeriesChart', async () => {
		const routes = { a: 7, b: 6, c: 5, d: 4, e: 3, f: 2, g: 1 }
		await act(async () => {
			root.render(
				<ApiUsageBreakdown
					usageStats={{ stats: [{ date: '2026-07-19', totalRequests: 28, routes }] }}
					isLoading={false}
					isError={false}
				/>
			)
		})

		const chartProps = mocks.chartProps!
		expect(chartProps.dataset).toEqual({
			dimensions: ['date', 'a', 'b', 'c', 'd', 'e', 'f', 'Others'],
			source: [[Date.UTC(2026, 6, 19), 7, 6, 5, 4, 3, 2, 1]]
		})
		expect(chartProps.charts!.map((chart) => chart.encode)).toEqual([
			{ x: 0, y: 1 },
			{ x: 0, y: 2 },
			{ x: 0, y: 3 },
			{ x: 0, y: 4 },
			{ x: 0, y: 5 },
			{ x: 0, y: 6 },
			{ x: 0, y: 7 }
		])
	})
})
