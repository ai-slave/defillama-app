// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
	const instance = {
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
	return { init: vi.fn(() => instance), instance, use: vi.fn() }
})

vi.mock('echarts/core', () => ({
	graphic: { LinearGradient: class {} },
	init: mocks.init,
	use: mocks.use
}))
vi.mock('~/contexts/LocalStorage', () => ({ useDarkModeManager: () => [false] }))
vi.mock('~/hooks/useChartResize', () => ({ useChartResize: () => undefined }))
vi.mock('~/hooks/useMedia', () => ({ useMedia: () => false }))

import ChainCoreChart from './Chart'

function readPoints(option: any, name: string) {
	const series = option.series.find((item: any) => item.name === name)
	if (series.data) return series.data
	const y = typeof series.encode.y === 'number' ? series.encode.y : option.dataset.dimensions.indexOf(series.encode.y)
	return option.dataset.source.filter((row: unknown[]) => row[y] != null).map((row: unknown[]) => [row[0], row[y]])
}

describe('ChainOverview chart renderer contract', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		vi.clearAllMocks()
	})

	afterEach(async () => {
		if (container.childNodes.length) await act(async () => root.unmount())
		container.remove()
	})

	it('preserves sparse values, per-metric types, colors, axes, and caller overrides', async () => {
		await act(async () =>
			root.render(
				<ChainCoreChart
					chartData={{
						TVL: [
							[1_000, 10],
							[3_000, 12]
						],
						'Chain Fees': [
							[1_000, 2],
							[2_000, 3]
						],
						'Active Addresses': [[2_000, 100]]
					}}
					chartOptions={{ yAxis: { position: 'right', offset: 12, alignTicks: true } }}
					isThemeDark={false}
					valueSymbol="$"
				/>
			)
		)

		const option = mocks.instance.setOption.mock.calls.at(-1)![0]
		const tvlSeries = option.series.find((item: any) => item.name === 'TVL')
		expect(tvlSeries.data).toEqual([
			[1_000, 10],
			[3_000, 12]
		])
		expect(tvlSeries.connectNulls).toBeUndefined()
		expect(option.dataset.source).toEqual([])
		expect(option.series.filter((item: any) => item.name).map((item: any) => [item.name, item.type])).toEqual([
			['TVL', 'line'],
			['Chain Fees', 'bar'],
			['Active Addresses', 'bar']
		])
		expect(readPoints(option, 'TVL')).toEqual([
			[1_000, 10],
			[3_000, 12]
		])
		expect(readPoints(option, 'Chain Fees')).toEqual([
			[1_000, 2],
			[2_000, 3]
		])
		expect(option.yAxis[0]).toMatchObject({ position: 'right', offset: 12, alignTicks: true })
	})

	it('renders established cumulative values as lines without summing snapshot series again', async () => {
		await act(async () =>
			root.render(
				<ChainCoreChart
					chartData={{
						TVL: [
							[1_000, 10],
							[2_000, 12]
						],
						'Chain Fees': [
							[1_000, 2],
							[2_000, 5]
						],
						'Core Developers': [[2_000, 7]]
					}}
					groupBy="cumulative"
					isThemeDark={false}
				/>
			)
		)

		const option = mocks.instance.setOption.mock.calls.at(-1)![0]
		expect(readPoints(option, 'TVL')).toEqual([
			[1_000, 10],
			[2_000, 12]
		])
		expect(readPoints(option, 'Chain Fees')).toEqual([
			[1_000, 2],
			[2_000, 5]
		])
		expect(option.series.find((item: any) => item.name === 'Chain Fees').type).toBe('line')
		expect(option.series.find((item: any) => item.name === 'Core Developers').type).toBe('bar')
		expect(option.yAxis.every((axis: any) => axis.alignTicks == null)).toBe(true)
	})

	it('keeps the established Chain data zoom for a one-point series', async () => {
		await act(async () => root.render(<ChainCoreChart chartData={{ TVL: [[1_000, 10]] }} isThemeDark={false} />))

		expect(mocks.instance.setOption.mock.calls.at(-1)![0].dataZoom).toBeDefined()
	})

	it('keeps converted and intrinsically USD series units distinct on axes and tooltips', async () => {
		const timestamp = Date.UTC(2024, 0, 1)
		const usdSeries = ['Token Price', 'Token Mcap', 'Token Volume', 'Raises'] as const
		await act(async () =>
			root.render(
				<ChainCoreChart
					chartData={{
						TVL: [[timestamp, 1]],
						'Token Price': [[timestamp, 2_000]],
						'Token Mcap': [[timestamp, 3_000]],
						'Token Volume': [[timestamp, 4_000]],
						Raises: [[timestamp, 5_000]]
					}}
					isThemeDark={false}
					valueSymbol="ETH"
				/>
			)
		)

		const option = mocks.instance.setOption.mock.calls.at(-1)![0]
		const tvlAxisIndex = option.series.find((item: any) => item.name === 'TVL').yAxisIndex
		expect(option.yAxis[tvlAxisIndex].axisLabel.formatter(1)).toContain('ETH')
		for (const seriesName of usdSeries) {
			const axisIndex = option.series.find((item: any) => item.name === seriesName).yAxisIndex
			const axisLabel = option.yAxis[axisIndex].axisLabel.formatter(1)
			expect(axisLabel).toContain('$')
			expect(axisLabel).not.toContain('ETH')
		}

		const tooltip = option.tooltip.formatter(
			['TVL', ...usdSeries].map((seriesName, index) => ({
				axisValue: timestamp,
				seriesName,
				value: [timestamp, index + 1],
				encode: { y: [1] }
			}))
		)
		expect(tooltip).toContain('TVL&nbsp;&nbsp;1 ETH')
		for (const seriesName of usdSeries) {
			expect(tooltip).toContain(`${seriesName}&nbsp;&nbsp;$`)
		}
	})
})
