// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

type TestChartRow = Array<number | null>
type TestChartSeries = {
	name: string
	type?: string
	data?: Array<TestChartRow>
	encode?: { y: number | string }
	markArea?: { data: Array<Array<{ name?: string; xAxis: number }>> }
	connectNulls?: boolean
	yAxisIndex?: number
}
type TestChartOption = {
	series: Array<TestChartSeries>
	dataset: { dimensions: Array<string>; source: Array<TestChartRow> }
	yAxis: Array<{
		alignTicks?: boolean
		axisLabel?: { formatter?: (value: number) => string }
		min?: unknown
		scale?: boolean
	}>
	dataZoom?: object
}

const mocks = vi.hoisted(() => {
	const instance = {
		convertToPixel: vi.fn(() => 100),
		dispatchAction: vi.fn(),
		dispose: vi.fn(),
		getHeight: vi.fn(() => 360),
		getOption: vi.fn(() => ({})),
		isDisposed: vi.fn(() => false),
		off: vi.fn(),
		on: vi.fn(),
		resize: vi.fn(),
		setOption: vi.fn<(option: TestChartOption, settings?: { notMerge?: boolean }) => void>()
	}
	return { init: vi.fn(() => instance), instance, use: vi.fn() }
})

vi.mock('echarts/core', () => ({
	color: { lift: (value: string) => value },
	graphic: { LinearGradient: class {} },
	init: mocks.init,
	use: mocks.use
}))
vi.mock('~/contexts/LocalStorage', () => ({ useDarkModeManager: () => [false] }))
vi.mock('~/hooks/useChartResize', () => ({ useChartResize: () => undefined }))
vi.mock('~/hooks/useMedia', () => ({ useMedia: () => false }))

import ProtocolChart from './Chart'

function getSeries(option: TestChartOption, name: string): TestChartSeries {
	const series = option.series.find((item) => item.name === name)
	if (series === undefined) throw new Error(`Missing ${name} chart series`)
	return series
}

function readPoints(option: TestChartOption, name: string): Array<TestChartRow> {
	const series = getSeries(option, name)
	if (series.data) return series.data
	if (series.encode === undefined) throw new Error(`Missing ${name} chart encode`)
	const y = typeof series.encode.y === 'number' ? series.encode.y : option.dataset.dimensions.indexOf(series.encode.y)
	return option.dataset.source.filter((row) => row[y] != null).map((row) => [row[0] ?? null, row[y] ?? null])
}

function getLastOption(): TestChartOption {
	const option = mocks.instance.setOption.mock.calls.at(-1)?.[0]
	if (option === undefined) throw new Error('Expected chart options')
	return option
}

describe('ProtocolOverview chart renderer contract', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		vi.clearAllMocks()
	})

	afterEach(async () => {
		if (container.childNodes.length > 0) await act(async () => root.unmount())
		container.remove()
	})

	test('preserves sparse series, range annotations, event rail, and metric units', async () => {
		await act(async () =>
			root.render(
				<ProtocolChart
					chartData={{
						TVL: [
							[1000, 10],
							[3000, 12]
						],
						Fees: [
							[1000, 2],
							[2000, 3]
						],
						'Gas Used': [[2000, 100]],
						Unlocks: [[3000, 7]]
					}}
					chartColors={{ TVL: '#111', Fees: '#222', 'Gas Used': '#333', Unlocks: '#444' }}
					hallmarks={[[2000, 'Upgrade']]}
					rangeHallmarks={[[[1000, 3000], 'Migration']]}
					unlockTokenSymbol="TOKEN"
					gasUsedValueSymbol="GAS"
					isThemeDark={false}
				/>
			)
		)

		const option = getLastOption()
		expect(readPoints(option, 'TVL')).toEqual([
			[1000, 10],
			[3000, 12]
		])
		expect(readPoints(option, 'Fees')).toEqual([
			[1000, 2],
			[2000, 3]
		])
		expect(getSeries(option, 'Fees').type).toBe('bar')
		expect(getSeries(option, 'TVL').markArea?.data).toEqual([[{ name: 'Migration', xAxis: 1000 }, { xAxis: 3000 }]])
		expect(option.series.at(-1)?.name).toBe('Events')
		const gasAxis = option.yAxis.find((axis) => axis.axisLabel?.formatter?.(5)?.includes('GAS'))
		const unlockAxis = option.yAxis.find((axis) => axis.axisLabel?.formatter?.(5)?.includes('TOKEN'))
		expect(gasAxis).toBeTruthy()
		expect(unlockAxis).toBeTruthy()
	})

	test('keeps supplied cumulative values unchanged and switches flow bars to lines', async () => {
		await act(async () =>
			root.render(
				<ProtocolChart
					chartData={{
						TVL: [
							[1000, 10],
							[2000, 12]
						],
						Fees: [
							[1000, 2],
							[2000, 5]
						]
					}}
					chartColors={{ TVL: '#111', Fees: '#222' }}
					groupBy="cumulative"
					isThemeDark={false}
					hallmarks={null}
					rangeHallmarks={null}
				/>
			)
		)

		const option = getLastOption()
		expect(readPoints(option, 'TVL')).toEqual([
			[1000, 10],
			[2000, 12]
		])
		expect(readPoints(option, 'Fees')).toEqual([
			[1000, 2],
			[2000, 5]
		])
		expect(getSeries(option, 'Fees').type).toBe('line')
		expect(option.yAxis.every((axis) => axis.alignTicks == null)).toBe(true)
	})

	test('keeps explicit null observations as line gaps without injecting other series timestamps', async () => {
		await act(async () =>
			root.render(
				<ProtocolChart
					chartData={{
						TVL: [
							[1000, 10],
							[2500, null],
							[3000, 12]
						],
						Fees: [[2000, 5]]
					}}
					chartColors={{ TVL: '#111', Fees: '#222' }}
					hallmarks={null}
					rangeHallmarks={null}
					isThemeDark={false}
				/>
			)
		)

		const option = getLastOption()
		const tvlSeries = getSeries(option, 'TVL')
		expect(tvlSeries.data).toEqual([
			[1000, 10],
			[2500, null],
			[3000, 12]
		])
		expect(tvlSeries.connectNulls).toBeUndefined()
		expect(option.dataset.source).toEqual([])
	})

	test('omits data zoom when explicitly hidden', async () => {
		await act(async () =>
			root.render(
				<ProtocolChart
					chartData={{
						TVL: [
							[1000, 10],
							[2000, 12]
						]
					}}
					chartColors={{ TVL: '#111' }}
					hallmarks={null}
					rangeHallmarks={null}
					hideDataZoom
					isThemeDark={false}
				/>
			)
		)
		expect(getLastOption()).not.toHaveProperty('dataZoom')
	})

	test('scales price and valuation axes while keeping volume and TVL zero-based', async () => {
		await act(async () =>
			root.render(
				<ProtocolChart
					chartData={{
						'Token Price': [
							[1000, 77_000],
							[2000, 78_000]
						],
						'Token Volume': [
							[1000, 2000],
							[2000, 3000]
						],
						Mcap: [
							[1000, 1_500_000],
							[2000, 1_600_000]
						],
						FDV: [
							[1000, 1_800_000],
							[2000, 1_900_000]
						],
						TVL: [
							[1000, 500_000],
							[2000, 600_000]
						]
					}}
					chartColors={{ 'Token Price': '#111', 'Token Volume': '#222', Mcap: '#333', FDV: '#444' }}
					hallmarks={null}
					rangeHallmarks={null}
					isThemeDark={false}
				/>
			)
		)

		const option = getLastOption()
		const [priceAxis, volumeAxis, valuationAxis, tvlAxis] = option.yAxis
		expect(priceAxis).toMatchObject({ scale: true })
		expect(priceAxis).not.toHaveProperty('min')
		expect(volumeAxis?.scale).toBeUndefined()
		expect(volumeAxis?.min).toEqual(expect.any(Function))
		expect(valuationAxis).toMatchObject({ scale: true })
		expect(valuationAxis).not.toHaveProperty('min')
		expect(tvlAxis?.scale).toBeUndefined()
		expect(tvlAxis?.min).toEqual(expect.any(Function))
		expect(getSeries(option, 'Mcap').yAxisIndex).toBe(getSeries(option, 'FDV').yAxisIndex)
		expect(getSeries(option, 'Mcap').yAxisIndex).not.toBe(getSeries(option, 'TVL').yAxisIndex)
	})

	test('omits data zoom when every series has only one independently timed point', async () => {
		await act(async () =>
			root.render(
				<ProtocolChart
					chartData={{ TVL: [[1000, 10]], Fees: [[2000, 5]] }}
					chartColors={{ TVL: '#111', Fees: '#222' }}
					hallmarks={null}
					rangeHallmarks={null}
					isThemeDark={false}
				/>
			)
		)
		expect(getLastOption()).not.toHaveProperty('dataZoom')
	})

	test('keeps range hallmarks when the first series is a bar', async () => {
		await act(async () =>
			root.render(
				<ProtocolChart
					chartData={{
						Fees: [
							[1000, 2],
							[2000, 3]
						]
					}}
					chartColors={{ Fees: '#222' }}
					hallmarks={null}
					rangeHallmarks={[[[1000, 2000], 'Migration']]}
					isThemeDark={false}
				/>
			)
		)
		expect(getSeries(getLastOption(), 'Fees').markArea?.data).toHaveLength(1)
	})
})
