// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { KpiGrid } from './ui'

const NOTE = 'Distinct wallets with a trade of $100 or more.'
const DEF = 'Definition from ir-server metadata.'

describe('uniswap KPI definition tooltip', () => {
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

	it('falls back to the KPI payload note when no definition is passed', async () => {
		await act(async () =>
			root.render(
				<KpiGrid kpis={{ wallets: { value: 1, formatted: '26M', note: NOTE } }} items={[['wallets', 'Wallets']]} />
			)
		)

		expect(container.querySelector('[aria-label]')?.getAttribute('aria-label')).toBe(NOTE)
	})

	it('prefers an explicit definition over the payload note', async () => {
		await act(async () =>
			root.render(
				<KpiGrid kpis={{ wallets: { value: 1, formatted: '26M', note: NOTE } }} items={[['wallets', 'Wallets', DEF]]} />
			)
		)

		expect(container.querySelector('[aria-label]')?.getAttribute('aria-label')).toBe(DEF)
	})
})
