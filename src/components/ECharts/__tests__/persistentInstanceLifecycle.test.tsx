// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TreemapNode } from '../types'

const mocks = vi.hoisted(() => {
	const instances: Array<{
		convertToPixel: ReturnType<typeof vi.fn>
		dispose: ReturnType<typeof vi.fn>
		isDisposed: ReturnType<typeof vi.fn>
		off: ReturnType<typeof vi.fn>
		on: ReturnType<typeof vi.fn>
		resize: ReturnType<typeof vi.fn>
		setOption: ReturnType<typeof vi.fn>
	}> = []
	const init = vi.fn(() => {
		const instance = {
			convertToPixel: vi.fn(),
			dispose: vi.fn(),
			isDisposed: vi.fn(() => false),
			off: vi.fn(),
			on: vi.fn(),
			resize: vi.fn(),
			setOption: vi.fn()
		}
		instances.push(instance)
		return instance
	})
	return {
		graphic: {
			LinearGradient: vi.fn(function (...args: unknown[]) {
				return { args }
			})
		},
		init,
		instances,
		isDark: false,
		use: vi.fn()
	}
})

vi.mock('echarts/core', () => ({
	graphic: mocks.graphic,
	init: mocks.init,
	use: mocks.use
}))

vi.mock('~/contexts/LocalStorage', () => ({
	useDarkModeManager: () => [mocks.isDark]
}))

vi.mock('~/hooks/useChartResize', () => ({
	useChartResize: () => undefined
}))

vi.mock('~/hooks/useMedia', () => ({
	useMedia: () => false
}))

import { RadarChart } from '~/containers/MarketMakers/RadarChart'
import { RWAFlowTreemapChart } from '~/containers/RWA/FlowTreemapChart'
import { BarSparkline } from '../BarSparkline'
import CandlestickChart from '../CandlestickChart'
import HBarChart from '../HBarChart'
import MultiSeriesChart from '../MultiSeriesChart'
import ScatterChart from '../ScatterChart'
import { SparklineChart } from '../SparklineChart'
import TreemapChart from '../TreemapChart'

describe('persistent ECharts instances', () => {
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
		mocks.instances.length = 0
		mocks.isDark = false
		vi.clearAllMocks()
	})

	afterEach(async () => {
		if (container.childNodes.length > 0) await act(async () => root.unmount())
		container.remove()
		vi.unstubAllGlobals()
	})

	it('reuses the candlestick instance when its data changes', async () => {
		const initialData: Array<[number, number, number, number, number, number]> = [[1, 10, 11, 9, 12, 100]]
		const updatedData: Array<[number, number, number, number, number, number]> = [[2, 11, 12, 10, 13, 200]]

		await act(async () => root.render(<CandlestickChart data={initialData} />))
		const instance = mocks.instances[0]

		await act(async () => root.render(<CandlestickChart data={updatedData} />))

		expect(mocks.init).toHaveBeenCalledOnce()
		expect(instance.dispose).not.toHaveBeenCalled()
		expect(instance.setOption).toHaveBeenLastCalledWith(
			expect.objectContaining({ dataset: { source: updatedData } }),
			expect.any(Object)
		)

		await act(async () => root.unmount())
		expect(instance.dispose).toHaveBeenCalledOnce()
	})

	it.each([
		{ name: 'line', render: (data: Array<[number, number]>) => <SparklineChart data={data} areaColor="#269f3c" /> },
		{ name: 'bar', render: (data: Array<[number, number]>) => <BarSparkline data={data} /> }
	])('reuses the $name sparkline instance while data remains non-empty', async ({ render }) => {
		await act(async () => root.render(render([[1, 10]])))
		const instance = mocks.instances[0]

		await act(async () => root.render(render([[2, 20]])))

		expect(mocks.init).toHaveBeenCalledOnce()
		expect(instance.dispose).not.toHaveBeenCalled()

		await act(async () => root.render(render([])))
		expect(instance.dispose).toHaveBeenCalledOnce()

		await act(async () => root.render(render([[3, 30]])))
		expect(mocks.init).toHaveBeenCalledTimes(2)
	})

	it('keeps negative bar sparkline values inside the padded y-axis extent', async () => {
		await act(async () =>
			root.render(
				<BarSparkline
					data={[
						[1, -10],
						[2, -5]
					]}
				/>
			)
		)

		const negativeYAxis = mocks.instances[0].setOption.mock.calls.at(-1)?.[0].yAxis
		expect(negativeYAxis.min({ min: -10, max: -5 })).toBeCloseTo(-10.4)
		expect(negativeYAxis.max({ min: -10, max: -5 })).toBeCloseTo(-4.6)

		await act(async () =>
			root.render(
				<BarSparkline
					data={[
						[1, 0],
						[2, 10]
					]}
				/>
			)
		)
		const nonNegativeYAxis = mocks.instances[0].setOption.mock.calls.at(-1)?.[0].yAxis
		expect(nonNegativeYAxis.min({ min: 0, max: 10 })).toBe(0)
	})

	it('reuses the treemap instance and its event subscriptions across data updates', async () => {
		const initialData: TreemapNode[] = [{ name: 'Asset', path: 'Group/Asset', value: [100, null, null] }]
		const updatedData: TreemapNode[] = [{ name: 'Asset', path: 'Group/Asset', value: [200, null, null] }]

		await act(async () => root.render(<TreemapChart treeData={initialData} variant="rwa" />))
		const instance = mocks.instances[0]

		await act(async () => root.render(<TreemapChart treeData={updatedData} variant="rwa" />))

		expect(mocks.init).toHaveBeenCalledOnce()
		expect(instance.dispose).not.toHaveBeenCalled()
		expect(instance.on).toHaveBeenCalledTimes(2)
		const latestOption = instance.setOption.mock.calls.at(-1)?.[0]
		expect(latestOption.series[0].data).toBe(updatedData)
		expect(latestOption.series[0].data[0].value[0]).toBe(200)
		expect(instance.setOption.mock.calls.at(-1)?.[1]).toEqual({ notMerge: true })

		await act(async () => root.unmount())
		expect(instance.off).toHaveBeenCalledTimes(2)
		expect(instance.dispose).toHaveBeenCalledOnce()
	})

	it('keeps narrative restore controls and label content while passing canonical data through', async () => {
		const data: TreemapNode[] = [
			{
				name: 'Lending',
				path: 'Lending',
				value: [100, null, null, 0],
				children: [{ name: 'Aave', path: 'Lending/Aave', value: [100, 12.5, 12.5, 100] }]
			}
		]

		await act(async () => root.render(<TreemapChart treeData={data} variant="narrative" colorMode="categorical" />))

		const option = mocks.instances[0].setOption.mock.calls.at(-1)?.[0]
		expect(option.toolbox).toEqual({ feature: { restore: {} } })
		expect(option.series[0].data).toBe(data)
		expect(option.series[0].visualDimension).toBeUndefined()
		expect(
			option.series[0].label.formatter({
				name: 'Aave',
				value: data[0].children![0].value,
				data: data[0].children![0]
			})
		).toContain('{name|Aave}')
	})

	it('reuses the horizontal bar instance and its observer subscription across data updates', async () => {
		await act(async () => root.render(<HBarChart categories={['A']} values={[10]} />))
		const instance = mocks.instances[0]

		await act(async () => root.render(<HBarChart categories={['A']} values={[20]} />))

		expect(mocks.init).toHaveBeenCalledOnce()
		expect(instance.dispose).not.toHaveBeenCalled()
		expect(instance.on).toHaveBeenCalledOnce()
		const latestOption = instance.setOption.mock.calls.at(-1)?.[0]
		expect(latestOption.series[0].data[0].value).toBe(20)
		expect(latestOption.tooltip.formatter([{ name: 'A', seriesName: 'Series', value: 20 }])).toBe(
			'<div style="font-weight: 600; margin-bottom: 4px;">A</div><div>$20</div>'
		)

		await act(async () => root.unmount())
		expect(instance.off).toHaveBeenCalledOnce()
		expect(instance.dispose).toHaveBeenCalledOnce()
	})

	it('shows every grouped horizontal bar series in the axis tooltip', async () => {
		await act(async () =>
			root.render(
				<HBarChart
					categories={['Ethereum']}
					values={[10]}
					valueSymbol="$"
					series={[
						{ name: 'Revenue', values: [10], color: '#111' },
						{ name: 'Users', values: [20], color: '#222' }
					]}
				/>
			)
		)

		const formatter = mocks.instances[0].setOption.mock.calls.at(-1)?.[0].tooltip.formatter
		const tooltip = formatter([
			{ name: 'Ethereum', seriesName: 'Revenue', marker: 'A', value: 10 },
			{ name: 'Ethereum', seriesName: 'Users', marker: 'B', value: 20 }
		])
		expect(tooltip).toContain('Ethereum')
		expect(tooltip).toContain('ARevenue: $10')
		expect(tooltip).toContain('BUsers: $20')
	})

	it('reuses the scatter instance when its data changes', async () => {
		await act(async () => root.render(<ScatterChart chartData={[{ projectName: 'Project', sigma: 10, mu: 20 }]} />))
		const instance = mocks.instances[0]

		await act(async () => root.render(<ScatterChart chartData={[{ projectName: 'Project', sigma: 30, mu: 40 }]} />))

		expect(mocks.init).toHaveBeenCalledOnce()
		expect(instance.dispose).not.toHaveBeenCalled()
		const latestOption = instance.setOption.mock.calls.at(-1)?.[0]
		expect(latestOption.series[0].data[0].slice(0, 2)).toEqual([30, 40])

		await act(async () => root.unmount())
		expect(instance.dispose).toHaveBeenCalledOnce()
	})

	it('updates the radar axis color when only the app theme changes', async () => {
		const scores = {
			composite: 9,
			tradingKpis: 8,
			trustIntegration: 7,
			coverageCapabilities: 6,
			uptime: 5,
			integrationLevel: 4
		}

		await act(async () => root.render(<RadarChart scores={scores} />))
		const instance = mocks.instances[0]
		expect(instance.setOption.mock.calls.at(-1)?.[0].radar.axisName.color).toBe('#6f6f6f')

		mocks.isDark = true
		await act(async () => root.render(<RadarChart scores={scores} />))

		expect(mocks.init).toHaveBeenCalledOnce()
		expect(instance.setOption.mock.calls.at(-1)?.[0].radar.axisName.color).toBe('#878787')
	})

	it('reuses the RWA flow treemap instance across data updates', async () => {
		const initialNode = { name: 'A', value: [100, 1] as [number, number], netFlowUsd: 1 }
		const updatedNode = { name: 'A', value: [200, 2] as [number, number], netFlowUsd: 2 }

		await act(async () => root.render(<RWAFlowTreemapChart nodes={[initialNode]} sizeLabel="TVL" periodLabel="30d" />))
		const instance = mocks.instances[0]

		await act(async () => root.render(<RWAFlowTreemapChart nodes={[updatedNode]} sizeLabel="TVL" periodLabel="30d" />))

		expect(mocks.init).toHaveBeenCalledOnce()
		expect(instance.dispose).not.toHaveBeenCalled()
		expect(instance.setOption.mock.calls.at(-1)?.[0].series[0].data[0].value).toEqual([200, 2])

		await act(async () => root.unmount())
		expect(instance.dispose).toHaveBeenCalledOnce()
	})

	it('keeps per-axis units in legacy mixed-metric labels and tooltips', async () => {
		await act(async () =>
			root.render(
				<MultiSeriesChart
					series={[
						{ data: [[1, 10]], type: 'line', name: 'Fees', color: '#111', metricType: 'fees' },
						{ data: [[1, 5]], type: 'line', name: 'Median APY', color: '#222', metricType: 'medianApy' },
						{ data: [[1, 3]], type: 'line', name: 'Users', color: '#333', metricType: 'users' }
					]}
					valueSymbol="$"
					chartOptions={{ yAxis: { axisLabel: { formatter: (value: number) => `$${value}` } } }}
				/>
			)
		)

		const option = mocks.instances[0].setOption.mock.calls.at(-1)?.[0]
		expect(option.yAxis).toHaveLength(3)
		expect(option.yAxis[0].axisLabel.formatter(5)).toBe('$5')
		expect(option.yAxis[1].axisLabel.formatter(5)).toContain('%')
		expect(option.yAxis[2].axisLabel.formatter(5)).not.toContain('$')

		const tooltip = option.tooltip.formatter([
			{ marker: '', seriesName: 'Fees', value: [1_000, 10] },
			{ marker: '', seriesName: 'Median APY', value: [1_000, 5] },
			{ marker: '', seriesName: 'Users', value: [1_000, 3] }
		])
		expect(tooltip).toContain('Median APY&nbsp;&nbsp;5 %')
		expect(tooltip).not.toContain('Users&nbsp;&nbsp;$')
	})

	it('formats a sparse explicit legacy axis with that series unit', async () => {
		await act(async () =>
			root.render(
				<MultiSeriesChart
					series={[
						{ data: [[1, 10]], type: 'line', name: 'Fees', color: '#111', metricType: 'fees' },
						{
							data: [[1, 5]],
							type: 'line',
							name: 'Median APY',
							color: '#222',
							metricType: 'medianApy',
							yAxisIndex: 2
						}
					]}
					valueSymbol="$"
				/>
			)
		)

		const option = mocks.instances[0].setOption.mock.calls.at(-1)?.[0]
		expect(option.series[1].yAxisIndex).toBe(2)
		expect(option.yAxis[2].axisLabel.formatter(5)).toContain('%')
	})

	it('replace-merges legacy dynamic arrays when series shrink and grow', async () => {
		const first = { data: [[1, 10]] as Array<[number, number]>, type: 'line' as const, name: 'A', color: '#111' }
		const second = { data: [[1, 20]] as Array<[number, number]>, type: 'line' as const, name: 'B', color: '#222' }
		await act(async () => root.render(<MultiSeriesChart series={[first, second]} />))

		await act(async () => root.render(<MultiSeriesChart series={[first]} hideDataZoom />))
		const instance = mocks.instances[0]
		const shrunkCall = instance.setOption.mock.calls.at(-1)
		expect(shrunkCall?.[0].series).toHaveLength(1)
		expect(shrunkCall?.[0].dataZoom).toEqual([])
		expect(shrunkCall?.[1]).toEqual({ replaceMerge: ['series', 'yAxis', 'dataZoom'] })

		await act(async () => root.render(<MultiSeriesChart series={[first, second]} />))
		const grownCall = instance.setOption.mock.calls.at(-1)
		expect(grownCall?.[0].series).toHaveLength(2)
		expect(grownCall?.[1]).toEqual({ replaceMerge: ['series', 'yAxis', 'dataZoom'] })
	})

	it('uses the caller value symbol when legacy series do not declare metric types', async () => {
		await act(async () =>
			root.render(
				<MultiSeriesChart
					series={[{ data: [[1, 5]], type: 'line', name: 'Supply', color: '#111' }]}
					valueSymbol=" NEAR"
				/>
			)
		)

		const tooltip = mocks.instances[0].setOption.mock.calls
			.at(-1)?.[0]
			.tooltip.formatter([{ marker: '', seriesName: 'Supply', value: [1_000, 5] }])
		expect(tooltip).toContain('Supply&nbsp;&nbsp;5')
		expect(tooltip).toContain('NEAR')
		expect(tooltip).not.toContain('$')
	})

	it('applies legacy chartOptions.series overrides to generated series', async () => {
		await act(async () =>
			root.render(
				<MultiSeriesChart
					series={[{ data: [[1, 10]], type: 'bar', name: 'Revenue', color: '#111' }]}
					chartOptions={{ series: { barMaxWidth: 30 } }}
				/>
			)
		)

		expect(mocks.instances[0].setOption.mock.calls.at(-1)?.[0].series[0].barMaxWidth).toBe(30)
	})

	it('groups interleaved yield scatter points in first-seen project order', async () => {
		await act(async () =>
			root.render(
				<ScatterChart
					chartData={[
						{ projectName: 'B', sigma: 1, mu: 2, symbol: 'B1' },
						{ projectName: 'A', sigma: 3, mu: 4, symbol: 'A1' },
						{ projectName: 'B', sigma: 5, mu: 6, symbol: 'B2' }
					]}
				/>
			)
		)

		const option = mocks.instances[0].setOption.mock.calls.at(-1)?.[0]
		expect(option.series.map((item) => item.name)).toEqual(['B', 'A'])
		expect(option.series[0].symbolSize).toBe(5)
		expect(option.series[0]).not.toHaveProperty('symbols')
		expect(option.series[0].data).toEqual([
			[1, 2, undefined, 'B1', undefined, undefined, undefined, undefined],
			[5, 6, undefined, 'B2', undefined, undefined, undefined, undefined]
		])
	})
})
