// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ChartWatermarkContext } from '../shared/watermark'

const mocks = vi.hoisted(() => {
	const instance = {
		convertToPixel: vi.fn(() => 0),
		dispatchAction: vi.fn(),
		dispose: vi.fn(),
		getHeight: vi.fn(() => 360),
		getOption: vi.fn(() => ({})),
		isDisposed: vi.fn(() => false),
		off: vi.fn(),
		on: vi.fn(),
		resize: vi.fn(),
		setOption: vi.fn()
	}

	return {
		init: vi.fn(() => instance),
		instance,
		use: vi.fn()
	}
})

vi.mock('echarts/core', () => ({
	color: { lift: (value: string) => value },
	graphic: { LinearGradient: class {} },
	init: mocks.init,
	use: mocks.use
}))

vi.mock('~/contexts/LocalStorage', () => ({
	useDarkModeManager: () => [false]
}))

vi.mock('~/hooks/useChartResize', () => ({
	useChartResize: () => undefined
}))

vi.mock('~/hooks/useMedia', () => ({
	useMedia: () => false
}))

import { CHART_COLORS } from '~/constants/colors'
import MultiSeriesChart from '.'
import type { MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from './types'

const CHARTS: Array<MultiSeriesChartSeriesConfig> = [{ type: 'line', name: 'Value', encode: { x: 0, y: 1 } }]
const INITIAL_DATASET: MultiSeriesChartDataset = {
	dimensions: ['timestamp', 'Value'],
	source: [[1, 10]]
}

describe('MultiSeriesChart lifecycle', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		vi.clearAllMocks()
	})

	afterEach(async () => {
		if (container.childNodes.length > 0) await act(async () => root.unmount())
		container.remove()
	})

	test('hides the canvas watermark inside Pro dashboards', async () => {
		await act(async () =>
			root.render(
				<ChartWatermarkContext.Provider value="export-only">
					<MultiSeriesChart dataset={INITIAL_DATASET} charts={CHARTS} exportButtons="hidden" />
				</ChartWatermarkContext.Provider>
			)
		)
		for (const [option] of mocks.instance.setOption.mock.calls) expect(option.graphic).toBeUndefined()
	})

	test('reuses one owned instance and stable listeners across rerenders', async () => {
		const onReady = vi.fn()

		await act(async () =>
			root.render(<MultiSeriesChart dataset={INITIAL_DATASET} charts={CHARTS} title="Initial" onReady={onReady} />)
		)

		expect(mocks.init).toHaveBeenCalledOnce()
		expect(mocks.instance.setOption).toHaveBeenCalledOnce()
		expect(mocks.instance.on.mock.calls.map(([event]) => event)).toEqual(['finished', 'globalout'])
		expect(onReady).toHaveBeenCalledOnce()
		expect(onReady).toHaveBeenCalledWith(mocks.instance)
		const initialOptions = mocks.instance.setOption.mock.calls[0][0]

		await act(async () =>
			root.render(<MultiSeriesChart dataset={INITIAL_DATASET} charts={CHARTS} title="Updated" onReady={onReady} />)
		)

		expect(mocks.instance.setOption).toHaveBeenCalledOnce()
		expect(mocks.instance.on).toHaveBeenCalledTimes(2)
		expect(onReady).toHaveBeenCalledOnce()

		const updatedDataset: MultiSeriesChartDataset = {
			dimensions: ['timestamp', 'Value'],
			source: [[2, 20]]
		}
		await act(async () =>
			root.render(<MultiSeriesChart dataset={updatedDataset} charts={CHARTS} title="Updated" onReady={onReady} />)
		)

		expect(mocks.init).toHaveBeenCalledOnce()
		expect(mocks.instance.setOption).toHaveBeenCalledTimes(2)
		const updatedOptions = mocks.instance.setOption.mock.calls.at(-1)?.[0]
		expect(updatedOptions.dataset.source).toBe(updatedDataset.source)
		expect(updatedOptions.series).toBe(initialOptions.series)
		expect(updatedOptions.yAxis).toBe(initialOptions.yAxis)
		expect(mocks.instance.dispose).not.toHaveBeenCalled()
		expect(onReady).toHaveBeenCalledOnce()

		await act(async () => root.unmount())

		expect(mocks.instance.off.mock.calls.map(([event]) => event)).toEqual(['finished', 'globalout'])
		expect(mocks.instance.dispose).toHaveBeenCalledOnce()
		expect(onReady).toHaveBeenLastCalledWith(null)
	})

	test('infers series in dimension order without assigning timestamp a color', async () => {
		const dataset: MultiSeriesChartDataset = {
			dimensions: ['First', 'timestamp', 'Second'],
			source: [[10, 1, 20]]
		}

		await act(async () => root.render(<MultiSeriesChart dataset={dataset} exportButtons="hidden" />))

		const inferredSeries = mocks.instance.setOption.mock.calls[0][0].series
		expect(inferredSeries.map((item: any) => item.name)).toEqual(['First', 'Second'])
		expect(inferredSeries.map((item: any) => item.itemStyle.color)).toEqual([CHART_COLORS[0], CHART_COLORS[1]])
	})

	test('infers the first dimension as the x-axis for category datasets', async () => {
		const dataset: MultiSeriesChartDataset = {
			dimensions: ['category', 'Value'],
			source: [['A', 10]]
		}

		await act(async () => root.render(<MultiSeriesChart dataset={dataset} exportButtons="hidden" />))

		const inferredSeries = mocks.instance.setOption.mock.calls[0][0].series
		expect(inferredSeries).toHaveLength(1)
		expect(inferredSeries[0]).toMatchObject({ name: 'Value', encode: { x: 0, y: 1 } })
	})

	test('only emits the large-mode option for bar series', async () => {
		const charts: Array<MultiSeriesChartSeriesConfig> = [
			{ type: 'line', name: 'Value', encode: { x: 'timestamp', y: 'Value' }, large: true },
			{ type: 'bar', name: 'Volume', encode: { x: 'timestamp', y: 'Volume' } }
		]
		const dataset: MultiSeriesChartDataset = {
			dimensions: ['timestamp', 'Value', 'Volume'],
			source: [[1, 10, 5]]
		}

		await act(async () => root.render(<MultiSeriesChart dataset={dataset} charts={charts} exportButtons="hidden" />))

		const [line, bar] = mocks.instance.setOption.mock.calls[0][0].series
		expect(line).not.toHaveProperty('large')
		expect(bar.large).toBe(true)
	})

	test('merges array data zoom overrides into the two default controllers by index', async () => {
		await act(async () =>
			root.render(
				<MultiSeriesChart
					dataset={{
						dimensions: ['timestamp', 'Value'],
						source: [
							[1, 10],
							[2, 20]
						]
					}}
					charts={CHARTS}
					chartOptions={{ dataZoom: [{ start: 70 }, { start: 80 }] }}
					exportButtons="hidden"
				/>
			)
		)

		const dataZoom = mocks.instance.setOption.mock.calls[0][0].dataZoom
		expect(dataZoom).toHaveLength(2)
		expect(dataZoom.map((zoom: { start: number }) => zoom.start)).toEqual([70, 80])
		expect(dataZoom.map((zoom: { end: number }) => zoom.end)).toEqual([100, 100])
		expect(dataZoom[1]).toMatchObject({
			selectedDataBackground: {
				lineStyle: { color: 'rgba(0, 0, 0, 0.65)', opacity: 1 },
				areaStyle: { color: 'rgba(0, 0, 0, 0.2)', opacity: 1 }
			}
		})
	})

	test('connects requested line gaps without changing bar gap behavior', async () => {
		const charts: Array<MultiSeriesChartSeriesConfig> = [
			{ type: 'line', name: 'Value', encode: { x: 'timestamp', y: 'Value' }, connectNulls: true },
			{ type: 'bar', name: 'Volume', encode: { x: 'timestamp', y: 'Volume' }, connectNulls: true }
		]
		const dataset: MultiSeriesChartDataset = {
			dimensions: ['timestamp', 'Value', 'Volume'],
			source: [
				[1, 10, 5],
				[2, null, null],
				[3, 20, 10]
			]
		}

		await act(async () => root.render(<MultiSeriesChart dataset={dataset} charts={charts} exportButtons="hidden" />))

		const [line, bar] = mocks.instance.setOption.mock.calls[0][0].series
		expect(line.connectNulls).toBe(true)
		expect(bar).not.toHaveProperty('connectNulls')
	})

	test('uses the selected series unit after a sparse y-axis remaps to the primary display axis', async () => {
		const charts: Array<MultiSeriesChartSeriesConfig> = [
			{
				type: 'line',
				name: 'Funding Rate',
				encode: { x: 'timestamp', y: 'Funding Rate' },
				yAxisIndex: 2,
				valueSymbol: '%'
			}
		]
		const dataset: MultiSeriesChartDataset = {
			dimensions: ['timestamp', 'Funding Rate'],
			source: [[1, 5]]
		}

		await act(async () =>
			root.render(<MultiSeriesChart dataset={dataset} charts={charts} valueSymbol="$" exportButtons="hidden" />)
		)

		const options = mocks.instance.setOption.mock.calls[0][0]
		expect(options.series[0].yAxisIndex).toBe(0)
		expect(options.yAxis[0].axisLabel.formatter(5)).toContain('%')
	})

	test('derives axis units and colors only from selected series', async () => {
		const charts: Array<MultiSeriesChartSeriesConfig> = [
			{
				type: 'line',
				name: 'TVL',
				encode: { x: 'timestamp', y: 'TVL' },
				color: '#111111',
				valueSymbol: '$'
			},
			{
				type: 'line',
				name: 'APY',
				encode: { x: 'timestamp', y: 'APY' },
				color: '#222222',
				valueSymbol: '%'
			}
		]
		const dataset: MultiSeriesChartDataset = {
			dimensions: ['timestamp', 'TVL', 'APY'],
			source: [[1, 10, 5]]
		}

		await act(async () =>
			root.render(
				<MultiSeriesChart
					dataset={dataset}
					charts={charts}
					selectedCharts={new Set(['APY'])}
					hallmarks={[[1, 'Launch']]}
					hallmarkStyle="mark-line"
					valueSymbol="$"
					exportButtons="hidden"
				/>
			)
		)

		const options = mocks.instance.setOption.mock.calls[0][0]
		expect(options.series).toHaveLength(1)
		expect(options.series[0].name).toBe('APY')
		expect(options.series[0].markLine).toBeDefined()
		expect(options.yAxis[0].axisLabel.formatter(5)).toContain('%')
		expect(options.yAxis[0].axisLabel.color).toBe('#6f6f6f')
	})

	test('filters selected string-encoded series without copying dataset rows', async () => {
		const charts: Array<MultiSeriesChartSeriesConfig> = [
			{ type: 'line', name: 'Hidden', encode: { x: 'category', y: 'Hidden' } },
			{ type: 'line', name: 'Visible', encode: { x: 'category', y: 'Visible' } }
		]
		const sourceRow = ['A', 10, 20]
		const dataset: MultiSeriesChartDataset = {
			dimensions: ['category', 'Hidden', 'Visible'],
			source: [sourceRow]
		}

		await act(async () =>
			root.render(
				<MultiSeriesChart
					dataset={dataset}
					charts={charts}
					selectedCharts={new Set(['Visible'])}
					exportButtons="hidden"
				/>
			)
		)

		const options = mocks.instance.setOption.mock.calls[0][0]
		expect(options.dataset.dimensions).toEqual([
			{ name: '__dimension_0', displayName: 'category' },
			{ name: '__dimension_1', displayName: 'Hidden' },
			{ name: '__dimension_2', displayName: 'Visible' }
		])
		expect(options.dataset.source[0]).toBe(sourceRow)
		expect(options.series).toHaveLength(1)
		expect(options.series[0].encode).toEqual({ x: 0, y: 2 })
		expect(sourceRow).toEqual(['A', 10, 20])
	})

	test('keeps numeric encodes stable when filtering hidden series', async () => {
		const charts: Array<MultiSeriesChartSeriesConfig> = [
			{ type: 'line', name: 'Hidden', encode: { x: 0, y: 1 } },
			{ type: 'line', name: 'Visible', encode: { x: 0, y: 2 } }
		]
		const dataset: MultiSeriesChartDataset = {
			dimensions: ['timestamp', 'Hidden', 'Visible'],
			source: [[1, 10, 20]]
		}

		await act(async () =>
			root.render(
				<MultiSeriesChart
					dataset={dataset}
					charts={charts}
					selectedCharts={new Set(['Visible'])}
					exportButtons="hidden"
				/>
			)
		)

		const options = mocks.instance.setOption.mock.calls[0][0]
		expect(options.dataset.dimensions).toEqual([
			{ name: '__dimension_0', displayName: 'timestamp' },
			{ name: '__dimension_1', displayName: 'Hidden' },
			{ name: '__dimension_2', displayName: 'Visible' }
		])
		expect(options.series[0].encode).toEqual({ x: 0, y: 2 })
	})

	test('finishes replacing the model before showing an always-visible tooltip', async () => {
		await act(async () =>
			root.render(
				<MultiSeriesChart dataset={INITIAL_DATASET} charts={CHARTS} alwaysShowTooltip exportButtons="hidden" />
			)
		)
		const updatedDataset: MultiSeriesChartDataset = {
			dimensions: INITIAL_DATASET.dimensions,
			source: [
				[1, 10],
				[2, 20]
			]
		}
		await act(async () =>
			root.render(
				<MultiSeriesChart dataset={updatedDataset} charts={CHARTS} alwaysShowTooltip exportButtons="hidden" />
			)
		)

		expect(mocks.instance.setOption).toHaveBeenCalledTimes(2)
		expect(mocks.instance.setOption.mock.calls.at(-1)?.[1]).toEqual({ notMerge: true })
		expect(mocks.instance.dispatchAction).toHaveBeenLastCalledWith({
			type: 'showTip',
			seriesIndex: 0,
			dataIndex: 1,
			position: [60, 0]
		})
		expect(mocks.instance.setOption.mock.invocationCallOrder.at(-1)!).toBeLessThan(
			mocks.instance.dispatchAction.mock.invocationCallOrder.at(-1)!
		)
	})

	test('derives direct-series bounds and sticky tooltip index from the visible shorter series', async () => {
		const charts: Array<MultiSeriesChartSeriesConfig> = [
			{
				type: 'line',
				name: 'Short',
				encode: { x: 0, y: 1 },
				data: [
					[10, 1],
					[20, 2]
				]
			},
			{
				type: 'line',
				name: 'Long',
				encode: { x: 0, y: 1 },
				data: [
					[1, 1],
					[50, 2],
					[100, 3]
				]
			}
		]

		await act(async () =>
			root.render(
				<MultiSeriesChart
					dataset={{ dimensions: ['timestamp', 'Short', 'Long'], source: [] }}
					charts={charts}
					selectedCharts={new Set(['Short'])}
					hallmarks={[[15, 'Event']]}
					hallmarksInMs
					alwaysShowTooltip
					exportButtons="hidden"
				/>
			)
		)

		const options = mocks.instance.setOption.mock.calls[0][0]
		expect(options.xAxis).toMatchObject({ min: 10, max: 20, axisLine: { onZeroAxisIndex: 0 } })
		expect(options.dataZoom).toBeDefined()
		expect(mocks.instance.dispatchAction).toHaveBeenCalledWith({
			type: 'showTip',
			seriesIndex: 0,
			dataIndex: 1,
			position: [60, 0]
		})
	})

	test('removes the default zero-baseline callback from a log-scaled axis', async () => {
		await act(async () =>
			root.render(
				<MultiSeriesChart
					dataset={INITIAL_DATASET}
					charts={CHARTS}
					logScale
					logEligibleYAxes={[0]}
					exportButtons="hidden"
				/>
			)
		)

		const axis = mocks.instance.setOption.mock.calls[0][0].yAxis[0]
		expect(axis.type).toBe('log')
		expect(axis).not.toHaveProperty('min')
	})

	test('preserves a selected sparse axis configuration when remapping it to log scale', async () => {
		const charts: Array<MultiSeriesChartSeriesConfig> = [
			{ type: 'line', name: 'TVL', encode: { x: 'timestamp', y: 'TVL' }, yAxisIndex: 0, valueSymbol: '$' },
			{
				type: 'line',
				name: 'Funding Rate',
				encode: { x: 'timestamp', y: 'Funding Rate' },
				yAxisIndex: 2,
				valueSymbol: '%'
			}
		]
		const dataset: MultiSeriesChartDataset = {
			dimensions: ['timestamp', 'TVL', 'Funding Rate'],
			source: [[1, 10, 5]]
		}

		await act(async () =>
			root.render(
				<MultiSeriesChart
					dataset={dataset}
					charts={charts}
					selectedCharts={new Set(['Funding Rate'])}
					chartOptions={{ yAxis: [{}, {}, { position: 'right', offset: 24, scale: true }] }}
					logScale
					logEligibleYAxes={[2]}
					exportButtons="hidden"
				/>
			)
		)

		const options = mocks.instance.setOption.mock.calls[0][0]
		expect(options.series).toHaveLength(1)
		expect(options.series[0]).toMatchObject({ name: 'Funding Rate', yAxisIndex: 0 })
		expect(options.yAxis).toHaveLength(1)
		expect(options.yAxis[0]).toMatchObject({ type: 'log', position: 'right', offset: 24 })
		expect(options.yAxis[0].axisLabel.formatter(5)).toContain('%')
		expect(options.yAxis[0]).not.toHaveProperty('min')
		expect(options.yAxis[0]).not.toHaveProperty('scale')
	})
})
