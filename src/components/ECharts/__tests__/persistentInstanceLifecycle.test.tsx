// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as echarts from 'echarts/core'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { RadarChart } from '~/containers/MarketMakers/RadarChart'
import { installChartCanvas } from '~/utils/testing/chartCanvas'
import { BarSparkline } from '../BarSparkline'
import CandlestickChart from '../CandlestickChart'
import type { CandlestickPoint } from '../CandlestickChart/types'
import HBarChart from '../HBarChart'
import ScatterChart from '../ScatterChart'
import { SparklineChart } from '../SparklineChart'
import TreemapChart from '../TreemapChart'
import BuilderTreemapChart from '../TreemapChart/Builder'
import MarketTreemapChart from '../TreemapChart/Market'
import type { MarketTreemapLeaf } from '../TreemapChart/Market/types'

let container: HTMLDivElement
let root: Root
// Charts probe their icons through React Query.
const client = new QueryClient()

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
	client.clear()
	document.cookie = 'defillama-theme=; Max-Age=0'
	vi.restoreAllMocks()
})

const render = (node: ReactNode) =>
	act(async () => root.render(<QueryClientProvider client={client}>{node}</QueryClientProvider>))

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
			name: 'market treemap',
			render: (value: number) => {
				// An empty icon URL skips the icon preload, which happy-dom cannot load.
				const leaves: Array<MarketTreemapLeaf> = [
					{
						name: 'A',
						value: [value, 1],
						iconKey: 1,
						iconUrl: '',
						itemStyle: { color: '#269f3c' },
						companyName: 'A Corp',
						marketCap: value
					}
				]
				return <MarketTreemapChart treeData={leaves} leaves={leaves} sizeLabel="Market Cap" colorLabel="Change" />
			},
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

	const treemapLeaf: MarketTreemapLeaf = {
		name: 'A',
		value: [1, 1],
		iconKey: 1,
		iconUrl: '',
		itemStyle: { color: '#269f3c' },
		companyName: 'A Corp',
		marketCap: 1
	}
	test.each([
		{
			name: 'treemap',
			render: (onReady: (instance: echarts.ECharts | null) => void) => (
				<TreemapChart
					treeData={[{ name: 'Asset', path: 'Group/Asset', value: [1, null, null] }]}
					variant="rwa"
					onReady={onReady}
				/>
			)
		},
		{
			name: 'builder treemap',
			render: (onReady: (instance: echarts.ECharts | null) => void) => (
				<BuilderTreemapChart data={[{ name: 'A', value: 1 }]} onReady={onReady} />
			)
		},
		{
			name: 'market treemap',
			render: (onReady: (instance: echarts.ECharts | null) => void) => (
				<MarketTreemapChart
					treeData={[treemapLeaf]}
					leaves={[treemapLeaf]}
					sizeLabel="Market Cap"
					colorLabel="Change"
					onReady={onReady}
				/>
			)
		}
	])(
		'hands the $name chart to its ready callback and takes it back through the latest one',
		async ({ render: chartFor }) => {
			const first = vi.fn()
			const latest = vi.fn()
			await render(chartFor(first))
			const instance = chart()
			await render(chartFor(latest))

			await act(async () => root.unmount())

			expect(first.mock.calls).toEqual([[instance]])
			expect(latest.mock.calls).toEqual([[null]])
		}
	)

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
