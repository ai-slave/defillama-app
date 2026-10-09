// @vitest-environment happy-dom

import * as echarts from 'echarts'
import { act, useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { installChartCanvas } from '~/utils/testing/chartCanvas'
import {
	EChartsRenderVisibilityProvider,
	interactiveStateFromOption,
	usePersistentEChartsLifecycle,
	withEChartsRenderVisibility
} from '../renderVisibility'

afterEach(() => {
	vi.restoreAllMocks()
	document.body.replaceChildren()
})

const Renderer = withEChartsRenderVisibility(function Renderer({ values }: { values: Array<number> }) {
	const ref = useRef<HTMLDivElement>(null)
	const lifecycle = usePersistentEChartsLifecycle()
	useEffect(() => {
		const instance = echarts.init(ref.current!)
		instance.setOption({
			legend: {},
			dataZoom: [{ type: 'inside', start: 0, end: 100 }],
			xAxis: { type: 'category', data: values.map(String) },
			yAxis: {},
			series: [
				{ name: 'TVL', type: 'line', data: values },
				{ name: 'Fees', type: 'line', data: values }
			]
		})
		lifecycle.restore(instance)
		return () => {
			lifecycle.capture(instance)
			instance.dispose()
		}
	}, [lifecycle, values])
	return <div ref={ref} />
})

test('brings back the legend selection and zoom range, but not stale data, after a scroll-away remount', async () => {
	installChartCanvas()
	const container = document.createElement('div')
	document.body.appendChild(container)
	const root = createRoot(container)
	const render = (visible: boolean, values: Array<number>) =>
		act(async () =>
			root.render(
				<EChartsRenderVisibilityProvider visible={visible}>
					<Renderer values={values} />
				</EChartsRenderVisibilityProvider>
			)
		)
	const option = () =>
		echarts.getInstanceByDom(container.querySelector<HTMLElement>('[_echarts_instance_]')!)!.getOption() as Record<
			string,
			any
		>

	const initial = [1, 2, 3, 4]
	await render(true, initial)
	const instance = echarts.getInstanceByDom(container.querySelector<HTMLElement>('[_echarts_instance_]')!)!
	instance.dispatchAction({ type: 'legendUnSelect', name: 'Fees' })
	instance.dispatchAction({ type: 'dataZoom', start: 25, end: 75 })

	await render(false, initial)
	await render(true, [5, 6, 7, 8])
	await act(() => new Promise((resolve) => requestAnimationFrame(resolve)))

	expect(option().legend[0].selected).toEqual({ TVL: true, Fees: false })
	expect(option().dataZoom[0]).toMatchObject({ start: 25, end: 75 })
	expect(option().series[0].data).toEqual([5, 6, 7, 8])
	await act(async () => root.unmount())
})

test('a chart without legend or zoom keeps no interactive state', () => {
	expect(interactiveStateFromOption({ series: [{ type: 'pie', data: [1] }] })).toEqual({})
})
