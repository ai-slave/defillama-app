// @vitest-environment happy-dom

import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import type { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'

type SelectWithComboboxProps = ComponentProps<typeof SelectWithCombobox>

const mocks = vi.hoisted(() => ({
	chartProps: null as IMultiSeriesChartProps | null,
	selectorProps: null as SelectWithComboboxProps | null
}))

vi.mock('~/components/ECharts/MultiSeriesChart', () => ({
	default: (props: IMultiSeriesChartProps) => {
		mocks.chartProps = props
		return <div data-testid="api-usage-chart" />
	}
}))

vi.mock('~/components/Select/SelectWithCombobox', () => ({
	SelectWithCombobox: (props: SelectWithComboboxProps) => {
		mocks.selectorProps = props
		return <div data-testid="route-selector" />
	}
}))

import { ApiUsageBreakdown } from './ApiUsageBreakdown'

describe('ApiUsageBreakdown', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2026-07-19T12:00:00Z'))
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		mocks.chartProps = null
		mocks.selectorProps = null
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		vi.useRealTimers()
	})

	test('passes positional rows and numeric encodes to MultiSeriesChart', async () => {
		const routes = { a: 7, b: 6, c: 5, d: 4, e: 3, f: 2, g: 1 }
		await act(async () => {
			root.render(
				<ApiUsageBreakdown
					usageStats={{ windowDays: 3, stats: [{ date: '2026-07-19', totalRequests: 28, routes }] }}
					isLoading={false}
					isError={false}
				/>
			)
		})

		const chartProps = mocks.chartProps!
		expect(chartProps.dataset).toEqual({
			dimensions: ['date', 'a', 'b', 'c', 'd', 'e', 'f', 'Others'],
			source: [
				[Date.UTC(2026, 6, 17), 0, 0, 0, 0, 0, 0, 0],
				[Date.UTC(2026, 6, 18), 0, 0, 0, 0, 0, 0, 0],
				[Date.UTC(2026, 6, 19), 7, 6, 5, 4, 3, 2, 1]
			]
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
		expect(chartProps.selectedCharts).toEqual(new Set(['a', 'b', 'c', 'd', 'e', 'f', 'Others']))
		expect(mocks.selectorProps!.allValues).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g'])

		await act(async () => mocks.selectorProps!.setSelectedValues(['a']))
		expect(mocks.chartProps!.selectedCharts).toEqual(new Set(['a']))

		await act(async () => mocks.selectorProps!.setSelectedValues([]))
		expect(mocks.chartProps!.selectedCharts).toEqual(new Set())
	})
})
