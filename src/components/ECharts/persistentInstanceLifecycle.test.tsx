// @vitest-environment happy-dom

import * as echarts from 'echarts/core'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { RadarChart } from '~/containers/MarketMakers/RadarChart'
import { RWAFlowTreemapChart } from '~/containers/RWA/FlowTreemapChart'
import { installChartCanvas } from '~/utils/test/chartCanvas'
import { BarSparkline } from './BarSparkline'
import CandlestickChart from './CandlestickChart'
import type { CandlestickPoint } from './CandlestickChart/types'
import HBarChart from './HBarChart'
import ScatterChart from './ScatterChart'
import { SparklineChart } from './SparklineChart'
import TreemapChart from './TreemapChart'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
	document.cookie = 'defillama-theme=dark'
	installChartCanvas()
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	document.cookie = 'defillama-theme=; Max-Age=0'
	vi.restoreAllMocks()
})

const render = (node: ReactNode) => act(async () => root.render(node))

function mountedChart() {
	const element = container.querySelector<HTMLElement>('[_echarts_instance_]')
	return element ? echarts.getInstanceByDom(element)! : null
}

function chart() {
	const instance = mountedChart()
	if (!instance) throw new Error('Expected a mounted chart')
	return instance
}

// ECharts normalizes every component to an array.
const option = () => chart().getOption() as Record<string, any>

const candle = (timestamp: number, close: number): CandlestickPoint => [timestamp, 10, close, 9, 12, 100]

describe('persistent ECharts instances', () => {
	test.each([
		{
			name: 'candlestick',
			render: (value: number) => <CandlestickChart data={[candle(1, value)]} />,
			shown: () => option().dataset[0].source[0][2]
		},
		{
			name: 'treemap',
			render: (value: number) => (
				<TreemapChart treeData={[{ name: 'Asset', path: 'Group/Asset', value: [value, null, null] }]} variant="rwa" />
			),
			shown: () => option().series[0].data[0].value[0]
		},
		{
			name: 'horizontal bar',
			render: (value: number) => <HBarChart categories={['A']} values={[value]} />,
			shown: () => option().series[0].data[0].value
		},
		{
			name: 'scatter',
			render: (value: number) => <ScatterChart chartData={[{ projectName: 'Project', sigma: value, mu: 20 }]} />,
			shown: () => option().series[0].data[0][0]
		},
		{
			name: 'RWA flow treemap',
			render: (value: number) => (
				<RWAFlowTreemapChart
					nodes={[{ name: 'A', value: [value, 1], netFlowUsd: 1 }]}
					sizeLabel="TVL"
					periodLabel="30d"
				/>
			),
			shown: () => option().series[0].data[0].value[0]
		}
	])('keeps the $name chart across data updates and releases it on unmount', async ({ render: chartFor, shown }) => {
		await render(chartFor(100))
		const instance = chart()

		await render(chartFor(200))

		expect(chart()).toBe(instance)
		expect(shown()).toBe(200)

		await act(async () => root.unmount())
		expect(instance.isDisposed()).toBe(true)
	})

	test('hands the candlestick chart to its ready callback and takes it back on unmount', async () => {
		const onReady = vi.fn()
		await render(<CandlestickChart data={[candle(1, 11)]} onReady={onReady} />)
		const instance = chart()

		await act(async () => root.unmount())

		expect(onReady.mock.calls).toEqual([[instance], [null]])
	})

	test.each([
		{ name: 'line', render: (data: Array<[number, number]>) => <SparklineChart data={data} areaColor="#269f3c" /> },
		{ name: 'bar', render: (data: Array<[number, number]>) => <BarSparkline data={data} /> }
	])('keeps the $name sparkline while it has data and drops it while empty', async ({ render: sparkline }) => {
		await render(sparkline([[1, 10]]))
		const instance = chart()

		await render(sparkline([[2, 20]]))
		expect(chart()).toBe(instance)

		await render(sparkline([]))
		expect(instance.isDisposed()).toBe(true)
		expect(mountedChart()).toBeNull()

		await render(sparkline([[3, 30]]))
		expect(chart()).not.toBe(instance)
	})

	test('recolors the radar axis on a theme change without rebuilding the chart', async () => {
		const scores = {
			composite: 9,
			tradingKpis: 8,
			trustIntegration: 7,
			coverageCapabilities: 6,
			uptime: 5,
			integrationLevel: 4
		}
		await render(<RadarChart scores={scores} />)
		const instance = chart()
		expect(option().radar[0].axisName.color).toBe('#878787')

		document.cookie = 'defillama-theme=light'
		await render(<RadarChart scores={scores} />)

		expect(chart()).toBe(instance)
		expect(option().radar[0].axisName.color).toBe('#6f6f6f')
	})

	test.each(['America/Los_Angeles', 'Asia/Tokyo'])(
		'places candlestick daily ticks on UTC midnights in %s',
		async (timeZone) => {
			const originalTimeZone = process.env.TZ
			process.env.TZ = timeZone
			try {
				const days = Array.from({ length: 7 }, (_, index) => Date.UTC(2026, 8, 20 + index))
				await render(<CandlestickChart data={days.map((day) => candle(day, 11))} />)

				// ECharts has no public tick API; the axis model is the only way to read tick instants.
				const axis = (chart() as unknown as { getModel(): any }).getModel().getComponent('xAxis', 0).axis
				const ticks = axis.scale.getTicks().map((tick: { value: number }) => tick.value)

				expect(ticks).toEqual(days)
			} finally {
				process.env.TZ = originalTimeZone
			}
		}
	)
})
