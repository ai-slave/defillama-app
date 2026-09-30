// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { VerifiedBlock } from '../../data/types'
import { VerifiedApyPanel } from '../VerifiedApyPanel'

const verified: VerifiedBlock = {
	apy: { avg_1d: 1.43, avg_7d: 1.45, avg_30d: 1.47 },
	apy_as_of: '2026-09-07T07:51:59.000Z',
	apy_confidence: 'high',
	exit: { status: 'instant', eta_seconds: null, fee_bps: 0, as_of: '2026-09-07T07:51:59.000Z' },
	exit_liquidity: null,
	tvl: { amount: '1', usd: 1, as_of: '2026-09-07' },
	methods: ['balanceOf(holder) — position size']
}

let container: HTMLDivElement
let root: Root
let scrolled: Array<string>

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	scrolled = []
	vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(function (this: HTMLElement) {
		scrolled.push(this.id)
	})
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	window.location.hash = ''
	vi.restoreAllMocks()
})

test('a panel that mounts after the page loaded scrolls into view when the URL names it', async () => {
	window.location.hash = '#how-we-verify'
	await act(async () => root.render(<VerifiedApyPanel verified={verified} />))

	expect(scrolled).toEqual(['how-we-verify'])
})

test('a panel the URL does not name leaves the page where it is', async () => {
	window.location.hash = '#exit-status'
	await act(async () => root.render(<VerifiedApyPanel verified={verified} />))

	expect(scrolled).toEqual([])
})
