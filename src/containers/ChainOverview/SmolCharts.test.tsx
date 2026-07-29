// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { oldBlue, purple } from '~/constants/colors'
import { domChartCrosshairStyles } from '~/ui/ChartTooltip'
import { FeesGeneratedChart } from './FeesGeneratedChart'
import { SmolBarChart } from './SmolBarChart'
import { SmolLineChart, smoothPath } from './SmolLineChart'
import { UpcomingUnlocksChart } from './UpcomingUnlocksChart'
import { useSmolChartHover } from './useSmolChartHover'

vi.mock('~/contexts/LocalStorage', () => ({ useDarkModeManager: () => [false] }))

let hoverHarnessRenderCount = 0

function HoverHarness({ dataLength }: { dataLength: number }) {
	hoverHarnessRenderCount++
	const { containerRef, tooltipRef, hoveredIndex, onMouseMove, onMouseLeave } = useSmolChartHover(dataLength)

	return (
		<div ref={containerRef} className="relative" onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}>
			<div ref={tooltipRef}>{hoveredIndex}</div>
		</div>
	)
}

describe('ChainOverview small charts', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	function getChartContainer() {
		const chart = container.querySelector<HTMLElement>('.relative')
		if (!chart) throw new Error('Expected small chart container')
		vi.spyOn(chart, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 100, 100))
		return chart
	}

	function hasCrosshair() {
		return Array.from(container.querySelectorAll<HTMLElement>('div')).some(
			(element) => element.className === domChartCrosshairStyles
		)
	}

	async function movePointer(chart: HTMLElement, clientX: number) {
		await act(async () => chart.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX, clientY: 10 })))
	}

	it('keeps empty charts empty', async () => {
		await act(async () => root.render(<SmolBarChart series={[]} />))
		expect(container.innerHTML).toBe('')

		await act(async () => root.render(<SmolLineChart series={[]} color="green" />))
		expect(container.innerHTML).toBe('')

		await act(async () => root.render(<FeesGeneratedChart series={[]} />))
		expect(container.innerHTML).toBe('')

		await act(async () => root.render(<UpcomingUnlocksChart data={[]} />))
		expect(container.innerHTML).toBe('')
	})

	it('preserves zero and negative bar rendering colors', async () => {
		await act(async () =>
			root.render(
				<SmolBarChart
					series={[
						[1, 0],
						[2, -5]
					]}
				/>
			)
		)

		const bars = Array.from(container.querySelectorAll<HTMLElement>('.min-h-px'))
		expect(bars).toHaveLength(2)
		expect(bars[0]?.style.height).toBe('0%')
		expect(bars[0]?.style.backgroundColor).toBe(oldBlue)
		expect(bars[1]?.style.backgroundColor).toBe(purple)
	})

	it('preserves empty, singleton, straight, and smoothed line paths', () => {
		expect(smoothPath([])).toBe('')
		expect(smoothPath([[1, 2]])).toBe('')
		expect(
			smoothPath([
				[0, 1],
				[2, 3]
			])
		).toBe('M0,1 L2,3')
		expect(
			smoothPath([
				[0, 0],
				[6, 6],
				[12, 0]
			])
		).toBe('M0,0 C1,1 4,6 6,6 C8,6 11,1 12,0')
	})

	it('moves the tooltip within one bucket without rerendering the chart', async () => {
		hoverHarnessRenderCount = 0
		await act(async () => root.render(<HoverHarness dataLength={4} />))
		const chart = getChartContainer()

		await movePointer(chart, 10)
		const renderCountAfterEnteringBucket = hoverHarnessRenderCount
		const tooltip = chart.firstElementChild
		if (!(tooltip instanceof HTMLElement)) throw new Error('Expected hover harness tooltip')
		expect(tooltip.textContent).toBe('0')
		expect(tooltip.style.left).toBe('22px')

		await movePointer(chart, 20)
		expect(hoverHarnessRenderCount).toBe(renderCountAfterEnteringBucket)
		expect(tooltip.style.left).toBe('32px')

		await movePointer(chart, 30)
		expect(hoverHarnessRenderCount).toBe(renderCountAfterEnteringBucket + 1)
		expect(tooltip.textContent).toBe('1')
	})

	it('clears hover once for a zero-width container', async () => {
		hoverHarnessRenderCount = 0
		await act(async () => root.render(<HoverHarness dataLength={4} />))
		const chart = getChartContainer()
		const rect = vi.spyOn(chart, 'getBoundingClientRect')
		const tooltip = chart.firstElementChild
		if (!(tooltip instanceof HTMLElement)) throw new Error('Expected hover harness tooltip')

		await movePointer(chart, 30)
		expect(tooltip.textContent).toBe('1')
		const renderCountBeforeClear = hoverHarnessRenderCount

		rect.mockReturnValue(new DOMRect(0, 0, 0, 100))
		await movePointer(chart, 30)
		expect(tooltip.textContent).toBe('')
		expect(hoverHarnessRenderCount).toBe(renderCountBeforeClear + 1)
		const renderCountAfterClear = hoverHarnessRenderCount

		await movePointer(chart, 30)
		expect(hoverHarnessRenderCount).toBe(renderCountAfterClear)
		expect(tooltip.style.left).not.toContain('NaN')
		expect(tooltip.style.top).not.toContain('NaN')
	})

	it('clears outside pointers and maps the exact right edge to the final bucket', async () => {
		await act(async () => root.render(<HoverHarness dataLength={4} />))
		const chart = getChartContainer()
		const tooltip = chart.firstElementChild
		if (!(tooltip instanceof HTMLElement)) throw new Error('Expected hover harness tooltip')

		await movePointer(chart, 30)
		expect(tooltip.textContent).toBe('1')

		await movePointer(chart, -1)
		expect(tooltip.textContent).toBe('')

		await movePointer(chart, 30)
		expect(tooltip.textContent).toBe('1')

		await movePointer(chart, 101)
		expect(tooltip.textContent).toBe('')

		await movePointer(chart, 100)
		expect(tooltip.textContent).toBe('3')
	})

	it('invalidates in-range stale hovers when each chart shrinks from four points to two', async () => {
		const hoverCases = [
			{
				name: 'small line chart',
				initial: (
					<SmolLineChart
						series={[
							[1, 10],
							[2, 20],
							[3, 30],
							[4, 40]
						]}
						color="green"
					/>
				),
				shorter: (
					<SmolLineChart
						series={[
							[5, 50],
							[6, 60]
						]}
						color="green"
					/>
				)
			},
			{
				name: 'small bar chart',
				initial: (
					<SmolBarChart
						series={[
							[1, 10],
							[2, 20],
							[3, 30],
							[4, 40]
						]}
					/>
				),
				shorter: (
					<SmolBarChart
						series={[
							[5, 50],
							[6, 60]
						]}
					/>
				)
			},
			{
				name: 'fees chart',
				initial: (
					<FeesGeneratedChart
						series={[
							['one', 10, '/one.png'],
							['two', 20, '/two.png'],
							['three', 30, '/three.png'],
							['four', 40, '/four.png']
						]}
					/>
				),
				shorter: (
					<FeesGeneratedChart
						series={[
							['five', 50, '/five.png'],
							['six', 60, '/six.png']
						]}
					/>
				)
			},
			{
				name: 'upcoming unlocks chart',
				initial: (
					<UpcomingUnlocksChart
						data={[1, 2, 3, 4].map((date) => ({
							date,
							total: date * 10,
							breakdown: [{ token: `Token ${date}`, value: date, pct: '1' }]
						}))}
					/>
				),
				shorter: (
					<UpcomingUnlocksChart
						data={[5, 6].map((date) => ({
							date,
							total: date * 10,
							breakdown: [{ token: `Token ${date}`, value: date, pct: '1' }]
						}))}
					/>
				)
			}
		]

		for (const hoverCase of hoverCases) {
			await act(async () => root.render(hoverCase.initial))
			const chart = getChartContainer()
			await movePointer(chart, 30)
			expect(container.textContent, `${hoverCase.name} should show its ordinary hover`).not.toBe('')
			expect(hasCrosshair(), `${hoverCase.name} should show its ordinary crosshair`).toBe(true)

			await act(async () => root.render(hoverCase.shorter))
			expect(container.textContent, `${hoverCase.name} should hide its stale tooltip`).toBe('')
			expect(hasCrosshair(), `${hoverCase.name} should hide its stale crosshair`).toBe(false)

			await act(async () => root.render(hoverCase.initial))
			expect(container.textContent, `${hoverCase.name} should not resurrect its old hover`).toBe('')
			expect(hasCrosshair(), `${hoverCase.name} should not resurrect its old crosshair`).toBe(false)
		}
	})

	it('does not render an out-of-range stale hover after the series becomes shorter', async () => {
		await act(async () =>
			root.render(
				<SmolLineChart
					series={[
						[1, 10],
						[2, 20]
					]}
					color="green"
				/>
			)
		)
		const chart = getChartContainer()
		await movePointer(chart, 75)
		expect(container.textContent).not.toBe('')

		await act(async () => root.render(<SmolLineChart series={[[1, 10]]} color="green" />))
		expect(container.textContent).toBe('')
	})

	it('does not open a stale fees route after the series length changes', async () => {
		const open = vi.spyOn(window, 'open').mockReturnValue(null)
		await act(async () =>
			root.render(
				<FeesGeneratedChart
					series={[
						['first', 10, '/first.png'],
						['old second', 20, '/old-second.png'],
						['third', 30, '/third.png'],
						['fourth', 40, '/fourth.png']
					]}
				/>
			)
		)
		let chart = getChartContainer()
		await movePointer(chart, 30)
		await act(async () => chart.click())
		expect(open).toHaveBeenLastCalledWith('/fees/old-second')

		open.mockClear()
		await act(async () =>
			root.render(
				<FeesGeneratedChart
					series={[
						['new first', 50, '/new-first.png'],
						['new second', 60, '/new-second.png']
					]}
				/>
			)
		)
		chart = getChartContainer()
		await act(async () => chart.click())
		expect(open).not.toHaveBeenCalled()

		await movePointer(chart, 75)
		await act(async () => chart.click())
		expect(open).toHaveBeenLastCalledWith('/fees/new-second')
	})
})
