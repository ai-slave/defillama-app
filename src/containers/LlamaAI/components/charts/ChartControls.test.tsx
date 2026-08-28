// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChartControlsModel } from '~/containers/LlamaAI/utils/chartCapabilities'
import { ChartControls } from './ChartControls'

vi.mock('~/utils/analytics/umami', () => ({ trackUmamiEvent: vi.fn() }))

const model = (overrides: Partial<ChartControlsModel>): ChartControlsModel => ({
	state: {
		stacked: false,
		percentage: false,
		cumulative: false,
		grouping: 'day',
		showHallmarks: false,
		showLabels: false,
		logScale: false
	},
	showGrouping: true,
	groupingLocked: false,
	showStack: false,
	showPercentage: false,
	showCumulative: false,
	showHallmarks: false,
	showLabels: false,
	showLogScale: false,
	groupingOptions: ['day', 'week', 'month', 'quarter', 'year'],
	...overrides
})

const noop = () => undefined

// A disabled W/M/Q/Y toggle never shows a hover tooltip, so the reason it is disabled has to be
// written next to it — and for the owner, link straight to where it gets fixed.
describe('ChartControls grouping lock', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	const render = (controls: ChartControlsModel, onOpenStyleEditor?: () => void) =>
		act(async () =>
			root.render(
				<ChartControls
					controls={controls}
					onStackedChange={noop}
					onPercentageChange={noop}
					onCumulativeChange={noop}
					onGroupingChange={noop}
					onHallmarksChange={noop}
					onLabelsChange={noop}
					onLogScaleChange={noop}
					onOpenStyleEditor={onOpenStyleEditor}
				/>
			)
		)

	it('tells the owner why W/M/Q/Y are disabled and opens the style editor', async () => {
		const onOpenStyleEditor = vi.fn()
		await render(model({ groupingLocked: true }), onOpenStyleEditor)

		const disabled = [...container.querySelectorAll<HTMLButtonElement>('button[disabled]')]
		expect(disabled).toHaveLength(4)

		const hint = [...container.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
			b.textContent?.includes('Set series aggregation')
		)
		if (!hint) throw new Error('Expected aggregation hint button')
		await act(async () => hint.dispatchEvent(new MouseEvent('click', { bubbles: true })))
		expect(onOpenStyleEditor).toHaveBeenCalledOnce()
	})

	it('explains the lock to viewers who cannot edit', async () => {
		await render(model({ groupingLocked: true }))
		expect(container.textContent).toContain('series aggregation not set')
		expect(container.textContent).not.toContain('Set series aggregation')
	})

	it('shows nothing extra when grouping is available', async () => {
		await render(model({}), vi.fn())
		expect(container.querySelectorAll('button[disabled]')).toHaveLength(0)
		expect(container.textContent).not.toContain('aggregation')
	})
})
