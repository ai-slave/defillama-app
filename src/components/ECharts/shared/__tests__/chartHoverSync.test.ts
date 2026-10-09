import * as echarts from 'echarts'
import { afterEach, expect, test, vi } from 'vitest'
import { joinChartHoverSync } from '../chartHoverSync'

const charts: Array<echarts.ECharts> = []

afterEach(() => {
	for (const chart of charts.splice(0)) chart.dispose()
	vi.unstubAllGlobals()
})

// Only the viewport observer reads the element, so an SSR chart can join with a stand-in.
const element = {} as Element

function lineChart() {
	const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: 600, height: 300 })
	chart.setOption({
		tooltip: { trigger: 'axis' },
		xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed'] },
		yAxis: {},
		series: [{ type: 'line', data: [1, 2, 3] }]
	})
	charts.push(chart)
	return chart
}

const pointAt = (chart: echarts.ECharts, dataIndex: number) =>
	chart.dispatchAction({ type: 'updateAxisPointer', seriesIndex: 0, dataIndex })

// ECharts keeps the axis pointer's state on the axis option; the value is the category index it points at.
function pointedCategory(chart: echarts.ECharts) {
	const [xAxis] = (chart.getOption() as { xAxis: Array<{ axisPointer: { status?: string; value?: number } }> }).xAxis
	return xAxis!.axisPointer.status === 'show' ? xAxis!.axisPointer.value : null
}

test('mirrors the pointer to the other chart once, without echoing it back to the chart that moved', () => {
	const source = lineChart()
	const target = lineChart()
	const leaveSource = joinChartHoverSync('dashboard-3', source, element)
	const leaveTarget = joinChartHoverSync('dashboard-3', target, element)
	// Without the echo guard each chart forwards the other's update back, and the pointer never settles.
	const sourceUpdates = vi.fn()
	source.on('updateAxisPointer', sourceUpdates)

	pointAt(source, 1)

	expect(pointedCategory(target)).toBe(1)
	expect(sourceUpdates).toHaveBeenCalledOnce()

	leaveSource()
	leaveTarget()
})

test('charts scrolled out of the viewport do not receive the pointer', () => {
	const observers: Array<IntersectionObserverCallback> = []
	vi.stubGlobal(
		'IntersectionObserver',
		class {
			observe() {}
			disconnect() {}
			constructor(callback: IntersectionObserverCallback) {
				observers.push(callback)
			}
		}
	)
	const source = lineChart()
	const offscreen = lineChart()
	const leaveSource = joinChartHoverSync('dashboard-4', source, element)
	const leaveOffscreen = joinChartHoverSync('dashboard-4', offscreen, element)
	const scrollOffscreen = (isIntersecting: boolean) =>
		observers[1]!([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver)

	scrollOffscreen(false)
	pointAt(source, 1)
	expect(pointedCategory(offscreen)).toBeNull()

	scrollOffscreen(true)
	pointAt(source, 2)
	expect(pointedCategory(offscreen)).toBe(2)

	leaveSource()
	leaveOffscreen()
})
