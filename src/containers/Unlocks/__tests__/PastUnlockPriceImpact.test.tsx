// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { waitForUi } from '~/utils/testing/waitForUi'
import { PastUnlockPriceImpact } from '../PastUnlockPriceImpact'
import type { EnrichedProtocolEmission } from '../queries'

const NOW = 1_700_000_000

const protocol = {
	name: 'Arbitrum',
	tSymbol: 'ARB',
	tPrice: 1,
	maxSupply: 10_000,
	mcap: 5000,
	historicalPrice: Array.from({ length: 15 }, (_, day): [number, number] => [NOW - (15 - day) * 86_400, 1 + day / 10]),
	lastEvent: [
		{
			description: 'of Team tokens were unlocked',
			category: 'insiders',
			unlockType: 'cliff',
			timestamp: NOW - 7 * 86_400,
			noOfTokens: [100]
		}
	]
} as unknown as EnrichedProtocolEmission

let container: HTMLDivElement
let root: Root
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

const card = () => document.querySelector('[role="dialog"]')

test("a key press on a row's details button opens its unlock card and moves focus into it", async () => {
	await act(async () => root.render(<PastUnlockPriceImpact data={[protocol]} initialNowSec={NOW} />))
	const details = container.querySelector<HTMLButtonElement>('button[aria-label="Unlock details for Arbitrum"]')!
	await act(async () => details.focus())
	// Enter and Space on a button click it with detail 0.
	await act(async () => details.click())
	await waitForUi(() => expect(card()?.contains(document.activeElement)).toBe(true))
	expect(card()?.textContent).toContain('ARB')
})

test('a pointer click opens the card and leaves focus on the button', async () => {
	await act(async () => root.render(<PastUnlockPriceImpact data={[protocol]} initialNowSec={NOW} />))
	const details = container.querySelector<HTMLButtonElement>('button[aria-label="Unlock details for Arbitrum"]')!
	await act(async () => details.focus())
	await act(async () => details.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })))
	await waitForUi(() => expect(card()?.textContent).toContain('ARB'))
	expect(document.activeElement).toBe(details)
})
