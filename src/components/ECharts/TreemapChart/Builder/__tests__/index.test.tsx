// @vitest-environment happy-dom

import * as echarts from 'echarts/core'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { readTreemapViewportExportState } from '~/components/ChartExport/chartPngExport'
import { installChartCanvas } from '~/utils/testing/chartCanvas'
import BuilderTreemapChart from '..'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
	installChartCanvas()
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.restoreAllMocks()
})

function chart() {
	return echarts.getInstanceByDom(container.querySelector<HTMLElement>('[_echarts_instance_]')!)!
}

const shownNames = () =>
	((chart().getOption() as Record<string, any>).series?.[0]?.data ?? []).map((item: { name: string }) => item.name)

test('switches between the empty notice and the treemap on one chart, dropping a stale drill-down', async () => {
	const onReady = vi.fn()
	await act(async () =>
		root.render(<BuilderTreemapChart exportButtons={{ omit: 'renderer test' }} data={[]} onReady={onReady} />)
	)
	const instance = chart()
	expect(container.textContent).toContain('No data available for treemap')

	await act(async () =>
		root.render(
			<BuilderTreemapChart
				exportButtons={{ omit: 'renderer test' }}
				data={[{ name: 'Initial', value: 10 }]}
				onReady={onReady}
			/>
		)
	)
	expect(container.textContent).not.toContain('No data available for treemap')
	expect(shownNames()).toEqual(['Initial'])

	// A user click drills into the node; the export reads that focus to reproduce the viewport.
	;(instance as unknown as { trigger(event: string, params: unknown): void }).trigger('click', {
		seriesType: 'treemap',
		seriesIndex: 0,
		dataIndex: 1
	})
	expect(readTreemapViewportExportState(instance)).toMatchObject({ actionType: 'treemapZoomToNode' })

	await act(async () =>
		root.render(<BuilderTreemapChart exportButtons={{ omit: 'renderer test' }} data={[]} onReady={onReady} />)
	)
	expect(container.textContent).toContain('No data available for treemap')
	expect(readTreemapViewportExportState(instance)).toBeNull()

	await act(async () =>
		root.render(
			<BuilderTreemapChart
				exportButtons={{ omit: 'renderer test' }}
				data={[{ name: 'Current', value: 20 }]}
				onReady={onReady}
			/>
		)
	)
	expect(chart()).toBe(instance)
	expect(shownNames()).toEqual(['Current'])

	await act(async () => root.unmount())
	expect(instance.isDisposed()).toBe(true)
	expect(onReady.mock.calls).toEqual([[instance], [null]])
})
