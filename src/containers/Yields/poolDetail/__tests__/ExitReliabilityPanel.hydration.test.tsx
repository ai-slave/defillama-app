// @vitest-environment happy-dom

// The share is formatted with Intl, the classic server/client split. `numberFormat` pins en-US, so
// this guards that rather than assuming it.

import { act } from 'react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { ExitReliabilityModel } from '../exitReliability'
import { ExitReliabilityPanel } from '../ExitReliabilityPanel'

function model(): ExitReliabilityModel {
	return {
		measuredDays: 485,
		fullDays: 434,
		queuedDays: 0,
		incidents: [
			{
				from: '2026-09-03',
				days: 12,
				kind: 'partial',
				outcome: 'ok_partial',
				availableUsd: 0.0000038,
				tvlUsd: 889_680_000
			},
			{
				from: '2026-09-02',
				days: 1,
				kind: 'liquidity',
				outcome: 'reverted_liquidity',
				availableUsd: null,
				tvlUsd: null
			},
			{ from: '2026-07-26', days: 38, kind: 'partial', outcome: 'ok_partial', availableUsd: 8650, tvlUsd: 733_800_000 }
		],
		gapDays: 0,
		noExitDays: 0,
		lastInterruptionDaysAgo: 0,
		measuredSince: '2023-01-16'
	}
}

describe('ExitReliabilityPanel hydration', () => {
	let container: HTMLDivElement
	let root: Root | null = null
	let errors: Array<Array<unknown>> = []

	beforeEach(() => {
		container = document.createElement('div')
		document.body.append(container)
		errors = []
		vi.spyOn(console, 'error').mockImplementation((...args: Array<unknown>) => {
			errors.push(args)
		})
	})

	afterEach(() => {
		act(() => root?.unmount())
		root = null
		container.remove()
		vi.restoreAllMocks()
	})

	test('renders the share on the server and hydrates it without a mismatch', () => {
		const element = <ExitReliabilityPanel model={model()} verified={null} holders={null} />
		container.innerHTML = renderToString(element)

		// In the SERVER html, not added on the client.
		expect(container.textContent).toContain('<0.01%')
		expect(container.textContent).toContain('$8.65k')
		expect(container.textContent).toContain('$733.8m')

		act(() => {
			root = hydrateRoot(container, element)
		})

		expect(errors).toEqual([])
		expect(container.textContent).toContain('<0.01%')
	})

	test('leaves a row with no receipt free of a share', () => {
		container.innerHTML = renderToString(<ExitReliabilityPanel model={model()} verified={null} holders={null} />)

		// Three incidents; only the first and last carry both figures.
		const shares = [...container.querySelectorAll('tbody tr')].map((row) => row.lastElementChild!.textContent)
		expect(shares).toEqual(['<0.01%', '—', '<0.01%'])
	})
})
