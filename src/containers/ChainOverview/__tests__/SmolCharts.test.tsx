// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { FeesGeneratedChart } from '../FeesGeneratedChart'
import { SmolBarChart } from '../SmolBarChart'
import { SmolLineChart } from '../SmolLineChart'
import { UpcomingUnlocksChart } from '../UpcomingUnlocksChart'
import { getSmolChartHoverIndex } from '../useSmolChartHover'

describe('small chart hover buckets', () => {
	test('keeps the index within a bucket and changes it across buckets', () => {
		expect([10, 20, 30].map((x) => getSmolChartHoverIndex(x, 100, 4))).toEqual([0, 0, 1])
	})

	test('maps the exact right edge to the final bucket and clears outside pointers', () => {
		expect(getSmolChartHoverIndex(100, 100, 4)).toBe(3)
		expect(getSmolChartHoverIndex(-1, 100, 4)).toBeNull()
		expect(getSmolChartHoverIndex(101, 100, 4)).toBeNull()
	})

	test('clears the hover for a zero-width container', () => {
		expect(getSmolChartHoverIndex(30, 0, 4)).toBeNull()
	})
})

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
		vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 100, 100))
		return container.querySelector<HTMLElement>('svg, img, div:empty')!
	}

	async function movePointer(chart: Element, clientX: number) {
		await act(async () => chart.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX, clientY: 10 })))
	}

	test('shows measured zero and negative values in bar tooltips', async () => {
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

		const chart = getChartContainer()
		await movePointer(chart, 10)
		expect(container.textContent).toContain('$0')
		await movePointer(chart, 90)
		expect(container.textContent).toContain('-$5')
	})

	test('invalidates in-range stale hovers when each chart shrinks from four points to two', async () => {
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
							cliff: date * 10,
							linear: 0,
							total: date * 10,
							unknownEventCount: 0,
							missingPriceProtocolCount: 0,
							breakdown: [{ token: `Token ${date}`, value: date, cliff: date, linear: 0, pct: '1' }]
						}))}
					/>
				),
				shorter: (
					<UpcomingUnlocksChart
						data={[5, 6].map((date) => ({
							date,
							cliff: date * 10,
							linear: 0,
							total: date * 10,
							unknownEventCount: 0,
							missingPriceProtocolCount: 0,
							breakdown: [{ token: `Token ${date}`, value: date, cliff: date, linear: 0, pct: '1' }]
						}))}
					/>
				)
			}
		]

		for (const hoverCase of hoverCases) {
			// oxlint-disable-next-line no-loop-func -- the closure reads only the current hover case, and the loop awaits it before moving on.
			await act(async () => root.render(hoverCase.initial))
			const chart = getChartContainer()
			await movePointer(chart, 30)
			expect(container.textContent, `${hoverCase.name} should show its ordinary hover`).not.toBe('')

			// oxlint-disable-next-line no-loop-func -- see above.
			await act(async () => root.render(hoverCase.shorter))
			expect(container.textContent, `${hoverCase.name} should hide its stale tooltip`).toBe('')

			// oxlint-disable-next-line no-loop-func -- see above.
			await act(async () => root.render(hoverCase.initial))
			expect(container.textContent, `${hoverCase.name} should not resurrect its old hover`).toBe('')
		}
	})

	test('does not render an out-of-range stale hover after the series becomes shorter', async () => {
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

	test('does not open a stale fees route after the series length changes', async () => {
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
		await act(async () => chart.dispatchEvent(new MouseEvent('click', { bubbles: true })))
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
		await act(async () => chart.dispatchEvent(new MouseEvent('click', { bubbles: true })))
		expect(open).not.toHaveBeenCalled()

		await movePointer(chart, 75)
		await act(async () => chart.dispatchEvent(new MouseEvent('click', { bubbles: true })))
		expect(open).toHaveBeenLastCalledWith('/fees/new-second')
	})
})
