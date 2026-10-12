// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { accessibleName } from '~/utils/testing/accessibleName'
import { waitForUi } from '~/utils/testing/waitForUi'
import { CategoryPerformanceContainer } from '../index'

vi.mock('next/router', () => ({ useRouter: () => ({ query: {}, pathname: '/narrative-tracker', push: vi.fn() }) }))
vi.mock('~/components/ECharts/MultiSeriesChart', () => ({ default: () => <p>series chart</p> }))
vi.mock('~/components/ECharts/TreemapChart', () => ({ default: () => <p>treemap chart</p> }))

let unmount = () => {}
afterEach(() => unmount())

test('picking Heatmap draws the treemap and keeps both chart exports', async () => {
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
	// The last .csv is the table's own export, which stays for every chart type.
	const exportNames = () =>
		[...container.querySelectorAll('button')]
			.map((button) => accessibleName(button))
			.filter((name) => name.startsWith('.'))
	const heatmap = [
		...container.querySelectorAll<HTMLInputElement>('[role="radiogroup"][aria-label="Chart type"] input')
	].find((input) => input.closest('label')!.textContent === 'Heatmap')!
	await waitForUi(() => expect(container.textContent).toContain('series chart'))
	expect(exportNames()).toEqual(['.csv', '.png', '.csv'])

	await act(async () => heatmap.click())

	await waitForUi(() => expect(container.textContent).toContain('treemap chart'))
	expect(container.textContent).not.toContain('series chart')
	expect(exportNames()).toEqual(['.csv', '.png', '.csv'])
})
