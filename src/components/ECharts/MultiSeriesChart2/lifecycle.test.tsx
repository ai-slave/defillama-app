// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
	const instance = {
		convertToPixel: vi.fn(() => 0),
		dispatchAction: vi.fn(),
		dispose: vi.fn(),
		getHeight: vi.fn(() => 360),
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
import MultiSeriesChart2 from '.'
import type { MultiSeriesChart2Dataset, MultiSeriesChart2SeriesConfig } from '../types'

const CHARTS: MultiSeriesChart2SeriesConfig[] = [
	{ type: 'line', name: 'Value', encode: { x: 'timestamp', y: 'Value' } }
]
const INITIAL_DATASET: MultiSeriesChart2Dataset = {
	dimensions: ['timestamp', 'Value'],
	source: [{ timestamp: 1, Value: 10 }]
}

describe('MultiSeriesChart2 lifecycle', () => {
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

	it('reuses one owned instance and stable listeners across rerenders', async () => {
		const onReady = vi.fn()

		await act(async () =>
			root.render(<MultiSeriesChart2 dataset={INITIAL_DATASET} charts={CHARTS} title="Initial" onReady={onReady} />)
		)

		expect(mocks.init).toHaveBeenCalledOnce()
		expect(mocks.instance.setOption).toHaveBeenCalledOnce()
		expect(mocks.instance.on.mock.calls.map(([event]) => event)).toEqual(['finished', 'globalout'])
		expect(onReady).toHaveBeenCalledOnce()
		expect(onReady).toHaveBeenCalledWith(mocks.instance)
		const initialOptions = mocks.instance.setOption.mock.calls[0][0]

		await act(async () =>
			root.render(<MultiSeriesChart2 dataset={INITIAL_DATASET} charts={CHARTS} title="Updated" onReady={onReady} />)
		)

		expect(mocks.instance.setOption).toHaveBeenCalledOnce()
		expect(mocks.instance.on).toHaveBeenCalledTimes(2)
		expect(onReady).toHaveBeenCalledOnce()

		const updatedDataset: MultiSeriesChart2Dataset = {
			dimensions: ['timestamp', 'Value'],
			source: [{ timestamp: 2, Value: 20 }]
		}
		await act(async () =>
			root.render(<MultiSeriesChart2 dataset={updatedDataset} charts={CHARTS} title="Updated" onReady={onReady} />)
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

	it('infers series in dimension order without assigning timestamp a color', async () => {
		const dataset: MultiSeriesChart2Dataset = {
			dimensions: ['First', 'timestamp', 'Second'],
			source: [{ timestamp: 1, First: 10, Second: 20 }]
		}

		await act(async () => root.render(<MultiSeriesChart2 dataset={dataset} exportButtons="hidden" />))

		const inferredSeries = mocks.instance.setOption.mock.calls[0][0].series
		expect(inferredSeries.map((item: any) => item.name)).toEqual(['First', 'Second'])
		expect(inferredSeries.map((item: any) => item.itemStyle.color)).toEqual([CHART_COLORS[0], CHART_COLORS[1]])
	})

	it('infers the first dimension as the x-axis for category datasets', async () => {
		const dataset: MultiSeriesChart2Dataset = {
			dimensions: ['category', 'Value'],
			source: [{ category: 'A', Value: 10 }]
		}

		await act(async () => root.render(<MultiSeriesChart2 dataset={dataset} exportButtons="hidden" />))

		const inferredSeries = mocks.instance.setOption.mock.calls[0][0].series
		expect(inferredSeries).toHaveLength(1)
		expect(inferredSeries[0]).toMatchObject({ name: 'Value', encode: { x: 'category', y: 'Value' } })
	})

	it('only emits the large-mode option for bar series', async () => {
		const charts: MultiSeriesChart2SeriesConfig[] = [
			{ type: 'line', name: 'Value', encode: { x: 'timestamp', y: 'Value' }, large: true },
			{ type: 'bar', name: 'Volume', encode: { x: 'timestamp', y: 'Volume' } }
		]
		const dataset: MultiSeriesChart2Dataset = {
			dimensions: ['timestamp', 'Value', 'Volume'],
			source: [{ timestamp: 1, Value: 10, Volume: 5 }]
		}

		await act(async () => root.render(<MultiSeriesChart2 dataset={dataset} charts={charts} exportButtons="hidden" />))

		const [line, bar] = mocks.instance.setOption.mock.calls[0][0].series
		expect(line).not.toHaveProperty('large')
		expect(bar.large).toBe(true)
	})

	it('connects requested line gaps without changing bar gap behavior', async () => {
		const charts: MultiSeriesChart2SeriesConfig[] = [
			{ type: 'line', name: 'Value', encode: { x: 'timestamp', y: 'Value' }, connectNulls: true },
			{ type: 'bar', name: 'Volume', encode: { x: 'timestamp', y: 'Volume' }, connectNulls: true }
		]
		const dataset: MultiSeriesChart2Dataset = {
			dimensions: ['timestamp', 'Value', 'Volume'],
			source: [
				{ timestamp: 1, Value: 10, Volume: 5 },
				{ timestamp: 2, Value: null, Volume: null },
				{ timestamp: 3, Value: 20, Volume: 10 }
			]
		}

		await act(async () => root.render(<MultiSeriesChart2 dataset={dataset} charts={charts} exportButtons="hidden" />))

		const [line, bar] = mocks.instance.setOption.mock.calls[0][0].series
		expect(line.connectNulls).toBe(true)
		expect(bar).not.toHaveProperty('connectNulls')
	})

	it('uses the selected series unit after a sparse y-axis remaps to the primary display axis', async () => {
		const charts: MultiSeriesChart2SeriesConfig[] = [
			{
				type: 'line',
				name: 'Funding Rate',
				encode: { x: 'timestamp', y: 'Funding Rate' },
				yAxisIndex: 2,
				valueSymbol: '%'
			}
		]
		const dataset: MultiSeriesChart2Dataset = {
			dimensions: ['timestamp', 'Funding Rate'],
			source: [{ timestamp: 1, 'Funding Rate': 5 }]
		}

		await act(async () =>
			root.render(<MultiSeriesChart2 dataset={dataset} charts={charts} valueSymbol="$" exportButtons="hidden" />)
		)

		const options = mocks.instance.setOption.mock.calls[0][0]
		expect(options.series[0].yAxisIndex).toBe(0)
		expect(options.yAxis[0].axisLabel.formatter(5)).toContain('%')
	})

	it('derives axis units and colors only from selected series', async () => {
		const charts: MultiSeriesChart2SeriesConfig[] = [
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
		const dataset: MultiSeriesChart2Dataset = {
			dimensions: ['timestamp', 'TVL', 'APY'],
			source: [{ timestamp: 1, TVL: 10, APY: 5 }]
		}

		await act(async () =>
			root.render(
				<MultiSeriesChart2
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

	it('passes only selected string-encoded dimensions to ECharts while preserving the category axis', async () => {
		const charts: MultiSeriesChart2SeriesConfig[] = [
			{ type: 'line', name: 'Hidden', encode: { x: 'category', y: 'Hidden' } },
			{ type: 'line', name: 'Visible', encode: { x: 'category', y: 'Visible' } }
		]
		const sourceRow = { category: 'A', Hidden: 10, Visible: 20 }
		const dataset: MultiSeriesChart2Dataset = {
			dimensions: ['category', 'Hidden', 'Visible'],
			source: [sourceRow]
		}

		await act(async () =>
			root.render(
				<MultiSeriesChart2
					dataset={dataset}
					charts={charts}
					selectedCharts={new Set(['Visible'])}
					exportButtons="hidden"
				/>
			)
		)

		const options = mocks.instance.setOption.mock.calls[0][0]
		expect(options.dataset.dimensions).toEqual(['category', 'Visible'])
		expect(options.dataset.source).toEqual([{ category: 'A', Visible: 20 }])
		expect(options.series).toHaveLength(1)
		expect(options.series[0].encode).toEqual({ x: 'category', y: 'Visible' })
		expect(sourceRow).toEqual({ category: 'A', Hidden: 10, Visible: 20 })
	})

	it('remaps numeric encodes after removing hidden dataset dimensions', async () => {
		const charts: MultiSeriesChart2SeriesConfig[] = [
			{ type: 'line', name: 'Hidden', encode: { x: 0, y: 1 } },
			{ type: 'line', name: 'Visible', encode: { x: 0, y: 2 } }
		]
		const dataset: MultiSeriesChart2Dataset = {
			dimensions: ['timestamp', 'Hidden', 'Visible'],
			source: [{ timestamp: 1, Hidden: 10, Visible: 20 }]
		}

		await act(async () =>
			root.render(
				<MultiSeriesChart2
					dataset={dataset}
					charts={charts}
					selectedCharts={new Set(['Visible'])}
					exportButtons="hidden"
				/>
			)
		)

		const options = mocks.instance.setOption.mock.calls[0][0]
		expect(options.dataset.dimensions).toEqual(['timestamp', 'Visible'])
		expect(options.series[0].encode).toEqual({ x: 0, y: 1 })
	})

	it('uses array rows when a selected dimension is named __proto__', async () => {
		const sourceRow: Record<string, string | number> = { timestamp: 1, Hidden: 10 }
		Object.defineProperty(sourceRow, '__proto__', {
			value: 20,
			enumerable: true,
			configurable: true,
			writable: true
		})
		const dataset: MultiSeriesChart2Dataset = {
			dimensions: ['timestamp', 'Hidden', '__proto__'],
			source: [sourceRow]
		}
		const charts: MultiSeriesChart2SeriesConfig[] = [
			{ type: 'line', name: 'Hidden', encode: { x: 'timestamp', y: 'Hidden' } },
			{ type: 'line', name: '__proto__', encode: { x: 'timestamp', y: '__proto__' } }
		]

		await act(async () => {
			root.render(
				<MultiSeriesChart2
					dataset={dataset}
					charts={charts}
					selectedCharts={new Set(['__proto__'])}
					exportButtons="hidden"
				/>
			)
		})

		const option = mocks.instance.setOption.mock.calls.at(-1)?.[0]
		expect(option.dataset.dimensions).toEqual(['timestamp', '__proto__'])
		expect(option.dataset.source).toEqual([[1, 20]])
	})

	it('uses array rows when a selected dimension is named hasOwnProperty', async () => {
		const sourceRow: Record<string, string | number> = { timestamp: 1, Hidden: 10 }
		Object.defineProperty(sourceRow, 'hasOwnProperty', {
			value: 20,
			enumerable: true,
			configurable: true,
			writable: true
		})
		const dataset: MultiSeriesChart2Dataset = {
			dimensions: ['timestamp', 'Hidden', 'hasOwnProperty'],
			source: [sourceRow]
		}
		const charts: MultiSeriesChart2SeriesConfig[] = [
			{ type: 'line', name: 'Hidden', encode: { x: 'timestamp', y: 'Hidden' } },
			{ type: 'line', name: 'hasOwnProperty', encode: { x: 'timestamp', y: 'hasOwnProperty' } }
		]

		await act(async () => {
			root.render(
				<MultiSeriesChart2
					dataset={dataset}
					charts={charts}
					selectedCharts={new Set(['hasOwnProperty'])}
					exportButtons="hidden"
				/>
			)
		})

		const option = mocks.instance.setOption.mock.calls.at(-1)?.[0]
		expect(option.dataset.dimensions).toEqual(['timestamp', 'hasOwnProperty'])
		expect(option.dataset.source).toEqual([[1, 20]])
	})

	it('reads the encoded x dimension from reserved-name array rows in the default tooltip', async () => {
		const timestamp = Date.UTC(2024, 0, 1)
		const sourceRow: Record<string, string | number> = { timestamp }
		Object.defineProperty(sourceRow, 'hasOwnProperty', {
			value: 20,
			enumerable: true,
			configurable: true,
			writable: true
		})
		const dataset: MultiSeriesChart2Dataset = {
			dimensions: ['hasOwnProperty', 'timestamp'],
			source: [sourceRow]
		}
		const charts: MultiSeriesChart2SeriesConfig[] = [
			{ type: 'line', name: 'hasOwnProperty', encode: { x: 'timestamp', y: 'hasOwnProperty' } }
		]

		await act(async () => root.render(<MultiSeriesChart2 dataset={dataset} charts={charts} exportButtons="hidden" />))

		const option = mocks.instance.setOption.mock.calls.at(-1)?.[0]
		expect(option.dataset.source).toEqual([[20, timestamp]])
		expect(
			option.tooltip.formatter([
				{
					seriesName: 'hasOwnProperty',
					data: [20, timestamp],
					value: [20, timestamp],
					encode: { x: [1], y: [0] }
				}
			])
		).toContain('01 Jan 2024')
	})

	it('finishes replacing the model before showing an always-visible tooltip', async () => {
		await act(async () =>
			root.render(
				<MultiSeriesChart2 dataset={INITIAL_DATASET} charts={CHARTS} alwaysShowTooltip exportButtons="hidden" />
			)
		)
		const updatedDataset: MultiSeriesChart2Dataset = {
			dimensions: INITIAL_DATASET.dimensions,
			source: [
				{ timestamp: 1, Value: 10 },
				{ timestamp: 2, Value: 20 }
			]
		}
		await act(async () =>
			root.render(
				<MultiSeriesChart2 dataset={updatedDataset} charts={CHARTS} alwaysShowTooltip exportButtons="hidden" />
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

	it('removes the default zero-baseline callback from a log-scaled axis', async () => {
		await act(async () =>
			root.render(
				<MultiSeriesChart2
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

	it('preserves a selected sparse axis configuration when remapping it to log scale', async () => {
		const charts: MultiSeriesChart2SeriesConfig[] = [
			{ type: 'line', name: 'TVL', encode: { x: 'timestamp', y: 'TVL' }, yAxisIndex: 0, valueSymbol: '$' },
			{
				type: 'line',
				name: 'Funding Rate',
				encode: { x: 'timestamp', y: 'Funding Rate' },
				yAxisIndex: 2,
				valueSymbol: '%'
			}
		]
		const dataset: MultiSeriesChart2Dataset = {
			dimensions: ['timestamp', 'TVL', 'Funding Rate'],
			source: [{ timestamp: 1, TVL: 10, 'Funding Rate': 5 }]
		}

		await act(async () =>
			root.render(
				<MultiSeriesChart2
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
		expect(options.yAxis[0]).toMatchObject({ type: 'log', position: 'right', offset: 24, scale: true })
		expect(options.yAxis[0].axisLabel.formatter(5)).toContain('%')
		expect(options.yAxis[0]).not.toHaveProperty('min')
	})
})
