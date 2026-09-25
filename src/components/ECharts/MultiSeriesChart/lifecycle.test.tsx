// @vitest-environment happy-dom

import * as echarts from 'echarts/core'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { installChartCanvas } from '~/utils/test/chartCanvas'
import MultiSeriesChart from '.'
import { EChartsRenderVisibilityProvider } from '../renderVisibility'
import { ChartMotionContext } from '../shared/chartMotion'
import type { IMultiSeriesChartProps, MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from './types'

const CHARTS: Array<MultiSeriesChartSeriesConfig> = [{ type: 'line', name: 'Value', encode: { x: 0, y: 1 } }]
const dataset = (...values: Array<number>): MultiSeriesChartDataset => ({
	dimensions: ['timestamp', 'Value'],
	source: values.map((value, index) => [Date.UTC(2026, 8, 20 + index), value])
})

let container: HTMLDivElement
let root: Root

beforeEach(() => {
	installChartCanvas()
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.restoreAllMocks()
})

const render = (node: ReactNode) => act(async () => root.render(node))

function chart() {
	const element = container.querySelector<HTMLElement>('[_echarts_instance_]')
	if (!element) throw new Error('Expected a mounted chart')
	return echarts.getInstanceByDom(element)!
}

// ECharts normalizes every component to an array; the chart only ever sets one of each.
const option = () => chart().getOption() as Record<string, any>

function Chart({
	visible = true,
	motion = 'default',
	...props
}: Partial<IMultiSeriesChartProps> & {
	visible?: boolean
	motion?: 'default' | 'draw'
}) {
	return (
		<ChartMotionContext.Provider value={motion}>
			<EChartsRenderVisibilityProvider visible={visible}>
				<MultiSeriesChart dataset={dataset(10)} charts={CHARTS} exportButtons="hidden" {...props} />
			</EChartsRenderVisibilityProvider>
		</ChartMotionContext.Provider>
	)
}

describe('MultiSeriesChart lifecycle', () => {
	test('keeps one chart across data updates and releases it on unmount', async () => {
		const onReady = vi.fn()
		await render(<Chart title="Initial" onReady={onReady} />)
		const instance = chart()
		expect(onReady.mock.calls).toEqual([[instance]])

		await render(<Chart title="Updated" onReady={onReady} dataset={dataset(10, 20)} />)

		expect(chart()).toBe(instance)
		expect(option().dataset[0].source.map((row: Array<number>) => row[1])).toEqual([10, 20])
		expect(onReady.mock.calls).toEqual([[instance]])

		await act(async () => root.unmount())

		expect(instance.isDisposed()).toBe(true)
		expect(onReady).toHaveBeenLastCalledWith(null)
	})

	test('draws itself in once, then updates and scroll-away remounts without redrawing', async () => {
		await render(<Chart motion="draw" />)
		expect(option()).toMatchObject({ animation: true, animationDuration: 700, animationEasing: 'quarticOut' })

		await render(<Chart motion="draw" dataset={dataset(10, 20)} />)
		expect(option().animationDuration).toBe(0)

		await render(<Chart motion="draw" visible={false} />)
		await render(<Chart motion="draw" />)
		expect(option().animationDuration).toBe(0)
	})

	test('keeps its first draw for when the data arrives', async () => {
		await render(<Chart motion="draw" dataset={{ dimensions: ['timestamp', 'Value'], source: [] }} />)
		expect(option().animationDuration).toBe(0)

		await render(<Chart motion="draw" />)
		expect(option()).toMatchObject({ animation: true, animationDuration: 700 })
	})

	test('keeps a hidden legend series hidden after scrolling away and back', async () => {
		const charts: Array<MultiSeriesChartSeriesConfig> = [
			{ type: 'line', name: 'TVL', encode: { x: 0, y: 1 } },
			{ type: 'line', name: 'Fees', encode: { x: 0, y: 2 } }
		]
		const twoSeries = { dimensions: ['timestamp', 'TVL', 'Fees'], source: [[Date.UTC(2026, 8, 20), 10, 1]] }
		await render(<Chart charts={charts} dataset={twoSeries} hideDefaultLegend={false} />)
		chart().dispatchAction({ type: 'legendUnSelect', name: 'Fees' })

		await render(<Chart charts={charts} dataset={twoSeries} hideDefaultLegend={false} visible={false} />)
		await render(<Chart charts={charts} dataset={twoSeries} hideDefaultLegend={false} />)
		await act(() => new Promise((resolve) => requestAnimationFrame(resolve)))

		expect(option().legend[0].selected).toEqual({ TVL: true, Fees: false })
	})

	test('moves an always-visible tooltip to the newest point when data arrives', async () => {
		await render(<Chart alwaysShowTooltip dataset={dataset(10, 20)} />)
		expect(container.textContent).toContain('Value: $20')

		await render(<Chart alwaysShowTooltip dataset={dataset(10, 20, 33)} />)
		expect(container.textContent).toContain('Value: $33')
	})

	test('pins the sticky tooltip and event time range to the visible series', async () => {
		const charts: Array<MultiSeriesChartSeriesConfig> = [
			{
				type: 'line',
				name: 'Short',
				encode: { x: 0, y: 1 },
				data: [
					[10_000, 1],
					[20_000, 2]
				]
			},
			{
				type: 'line',
				name: 'Long',
				encode: { x: 0, y: 1 },
				data: [
					[1000, 7],
					[50_000, 8],
					[100_000, 9]
				]
			}
		]
		await render(
			<Chart
				dataset={{ dimensions: ['timestamp', 'Short', 'Long'], source: [] }}
				charts={charts}
				selectedCharts={new Set(['Short'])}
				hallmarks={[[15_000, 'Event']]}
				hallmarksInMs
				alwaysShowTooltip
			/>
		)

		expect(option().xAxis[0]).toMatchObject({ min: 10_000, max: 20_000 })
		expect(container.textContent).toContain('Short: $2')
		expect(container.textContent).not.toContain('Long')
	})

	test.each(['America/Los_Angeles', 'Asia/Tokyo'])('places daily ticks on UTC midnights in %s', async (timeZone) => {
		const originalTimeZone = process.env.TZ
		process.env.TZ = timeZone
		try {
			const days = [10, 11, 12, 13, 14, 15, 16]
			await render(
				<Chart charts={[{ type: 'bar', name: 'Value', encode: { x: 0, y: 1 } }]} dataset={dataset(...days)} />
			)

			// ECharts has no public tick API; the axis model is the only way to read tick instants.
			const axis = (chart() as unknown as { getModel(): any }).getModel().getComponent('xAxis').axis
			const ticks = axis.scale.getTicks().map((tick: { value: number }) => tick.value)

			expect(ticks).toEqual(days.map((_, index) => Date.UTC(2026, 8, 20 + index)))
		} finally {
			process.env.TZ = originalTimeZone
		}
	})

	test('mirrors hover to the charts of its sync group, after a remount and until it leaves the group', async () => {
		const Pair = ({ targetVisible = true, targetGroup }: { targetVisible?: boolean; targetGroup?: string }) => (
			<>
				<div data-chart="source">
					<Chart syncGroup="pro-dashboard-1" dataset={dataset(10, 20)} />
				</div>
				<div data-chart="target">
					<Chart syncGroup={targetGroup} visible={targetVisible} dataset={dataset(70, 80)} />
				</div>
			</>
		)
		const chartIn = (name: string) =>
			echarts.getInstanceByDom(container.querySelector(`[data-chart="${name}"] [_echarts_instance_]`)!)!
		// Tooltips are appended to the body; the two charts carry different values to tell them apart.
		const shownTooltips = () =>
			[...document.querySelectorAll<HTMLElement>('.defillama-echarts-tooltip')]
				.filter((tooltip) => tooltip.style.display !== 'none')
				.map((tooltip) => tooltip.textContent)
				.join(' | ')
		const hoverSource = (dataIndex: number) =>
			act(() => chartIn('source').dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex }))

		await render(<Pair targetGroup="pro-dashboard-1" />)
		await hoverSource(1)
		expect(shownTooltips()).toContain('Value: $80')

		await render(<Pair targetGroup="pro-dashboard-1" targetVisible={false} />)
		await render(<Pair targetGroup="pro-dashboard-1" />)
		await hoverSource(0)
		expect(shownTooltips()).toContain('Value: $70')

		await render(<Pair />)
		await hoverSource(1)
		expect(shownTooltips()).not.toContain('Value: $80')
	})
})
