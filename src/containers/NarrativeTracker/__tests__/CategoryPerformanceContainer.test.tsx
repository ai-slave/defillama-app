// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { CategoryPerformanceContainer } from '../index'

vi.mock('next/router', () => ({ useRouter: () => ({ query: {}, pathname: '/narrative-tracker', push: vi.fn() }) }))
vi.mock('~/components/ECharts/MultiSeriesChart', () => ({ default: () => null }))
vi.mock('~/components/ECharts/TreemapChart', () => ({ default: () => null }))

let unmount = () => {}
afterEach(() => unmount())

test('the chart type is a radio pick in the chart toolbar, beside the period and denomination', async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	await act(async () =>
		root.render(
			<CategoryPerformanceContainer
				pctChanges={[]}
				performanceTimeSeries={{}}
				areaChartLegend={[]}
				isCoinPage={false}
			/>
		)
	)
	unmount = () => {
		act(() => root.unmount())
		container.remove()
	}
	const radio = (name: string) =>
		[...container.querySelectorAll<HTMLInputElement>('[role="radiogroup"][aria-label="Chart type"] input')].find(
			(input) => input.closest('label')!.textContent === name
		)!

	expect(container.querySelector('[role="tablist"]')).toBeNull()
	expect(radio('Linechart').checked).toBe(true)

	await act(async () => radio('Heatmap').click())
	expect(radio('Heatmap').checked).toBe(true)
	expect(radio('Linechart').checked).toBe(false)
	// The period and denomination stay in the same toolbar whatever chart is drawn.
	expect(container.querySelector('[role="radiogroup"][aria-label="Period"]')).not.toBeNull()
})
