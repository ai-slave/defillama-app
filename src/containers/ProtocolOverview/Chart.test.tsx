// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type TestChartRow = Array<number | null>
type TestChartSeries = {
	name: string
	type?: string
	data?: TestChartRow[]
	encode?: { y: number | string }
	markArea?: { data: Array<Array<{ name?: string; xAxis: number }>> }
	connectNulls?: boolean
}
type TestChartOption = {
	series: TestChartSeries[]
	dataset: { dimensions: string[]; source: TestChartRow[] }
	yAxis: Array<{ alignTicks?: boolean; axisLabel?: { formatter?: (value: number) => string } }>
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

function readPoints(option: TestChartOption, name: string): TestChartRow[] {
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
		if (container.childNodes.length) await act(async () => root.unmount())
		container.remove()
	})

	it('preserves sparse series, range annotations, event rail, and metric units', async () => {
		await act(async () =>
			root.render(
				<ProtocolChart
					chartData={{
						TVL: [
							[1_000, 10],
							[3_000, 12]
						],
						Fees: [
							[1_000, 2],
							[2_000, 3]
						],
						'Gas Used': [[2_000, 100]],
						Unlocks: [[3_000, 7]]
					}}
					chartColors={{ TVL: '#111', Fees: '#222', 'Gas Used': '#333', Unlocks: '#444' }}
					hallmarks={[[2_000, 'Upgrade']]}
					rangeHallmarks={[[[1_000, 3_000], 'Migration']]}
					unlockTokenSymbol="TOKEN"
					gasUsedValueSymbol="GAS"
					isThemeDark={false}
				/>
			)
		)

		const option = getLastOption()
		expect(readPoints(option, 'TVL')).toEqual([
			[1_000, 10],
			[3_000, 12]
		])
		expect(readPoints(option, 'Fees')).toEqual([
			[1_000, 2],
			[2_000, 3]
		])
		expect(getSeries(option, 'Fees').type).toBe('bar')
		expect(getSeries(option, 'TVL').markArea?.data).toEqual([[{ name: 'Migration', xAxis: 1_000 }, { xAxis: 3_000 }]])
		expect(option.series.at(-1)?.name).toBe('Events')
		const gasAxis = option.yAxis.find((axis) => axis.axisLabel?.formatter?.(5)?.includes('GAS'))
		const unlockAxis = option.yAxis.find((axis) => axis.axisLabel?.formatter?.(5)?.includes('TOKEN'))
		expect(gasAxis).toBeTruthy()
		expect(unlockAxis).toBeTruthy()
	})

	it('keeps supplied cumulative values unchanged and switches flow bars to lines', async () => {
		await act(async () =>
			root.render(
				<ProtocolChart
					chartData={{
						TVL: [
							[1_000, 10],
							[2_000, 12]
						],
						Fees: [
							[1_000, 2],
							[2_000, 5]
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
			[1_000, 10],
			[2_000, 12]
		])
		expect(readPoints(option, 'Fees')).toEqual([
			[1_000, 2],
			[2_000, 5]
		])
		expect(getSeries(option, 'Fees').type).toBe('line')
		expect(option.yAxis.every((axis) => axis.alignTicks == null)).toBe(true)
	})

	it('keeps explicit null observations as line gaps without injecting other series timestamps', async () => {
		await act(async () =>
			root.render(
				<ProtocolChart
					chartData={{
						TVL: [
							[1_000, 10],
							[2_500, null],
							[3_000, 12]
						],
						Fees: [[2_000, 5]]
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
			[1_000, 10],
			[2_500, null],
			[3_000, 12]
		])
		expect(tvlSeries.connectNulls).toBeUndefined()
		expect(option.dataset.source).toEqual([])
	})

	it('omits data zoom when explicitly hidden', async () => {
		await act(async () =>
			root.render(
				<ProtocolChart
					chartData={{
						TVL: [
							[1_000, 10],
							[2_000, 12]
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

	it('omits data zoom when every series has only one independently timed point', async () => {
		await act(async () =>
			root.render(
				<ProtocolChart
					chartData={{ TVL: [[1_000, 10]], Fees: [[2_000, 5]] }}
					chartColors={{ TVL: '#111', Fees: '#222' }}
					hallmarks={null}
					rangeHallmarks={null}
					isThemeDark={false}
				/>
			)
		)
		expect(getLastOption()).not.toHaveProperty('dataZoom')
	})

	it('keeps range hallmarks when the first series is a bar', async () => {
		await act(async () =>
			root.render(
				<ProtocolChart
					chartData={{
						Fees: [
							[1_000, 2],
							[2_000, 3]
						]
					}}
					chartColors={{ Fees: '#222' }}
					hallmarks={null}
					rangeHallmarks={[[[1_000, 2_000], 'Migration']]}
					isThemeDark={false}
				/>
			)
		)
		expect(getSeries(getLastOption(), 'Fees').markArea?.data).toHaveLength(1)
	})
})
