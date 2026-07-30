// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { KpiGrid } from './ui'

const DEF = 'Distinct wallets that transacted in the latest complete calendar month.'

describe('thorchain KPI definition tooltip', () => {
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

	// A `title` attribute never opens on touch, so the (i) has to be a real tooltip anchor.
	it('opens on touch', async () => {
		await act(async () =>
			root.render(<KpiGrid kpis={{ volume: { value: 1, formatted: '$1' } }} items={[['volume', 'Volume', DEF]]} />)
		)

		const anchor = container.querySelector('[aria-label]')!
		expect(anchor).not.toBeNull()
		expect(document.body.textContent).not.toContain(DEF)

		await act(async () => {
			anchor.dispatchEvent(new TouchEvent('touchstart', { bubbles: true }))
		})
		expect(document.body.textContent).toContain(DEF)
	})
})
