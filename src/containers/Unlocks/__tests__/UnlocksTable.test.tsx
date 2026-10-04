// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterContext } from 'next/dist/shared/lib/router-context.shared-runtime'
import type { NextRouter } from 'next/router'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { EmissionEvent } from '../api.types'
import { getEmissionAmountBreakdownOverInterval } from '../eventAmount'
import { type IEmission, UnlocksTable } from '../Table'

// The real router context, so a navigation re-renders every consumer the way Next does.
let query: Record<string, string | Array<string>> = {}
const push = vi.fn(async ({ query: next }: { query: Record<string, string | Array<string>> }) => {
	query = next
	await act(async () => root.render(table()))
})
const router = () => ({ pathname: '/unlocks', asPath: '/unlocks', query, push }) as unknown as NextRouter

const cliff = (category: string): EmissionEvent => ({
	description: `${category} unlock`,
	category,
	unlockType: 'cliff',
	timestamp: 60,
	noOfTokens: [100]
})

const protocol = (name: string, events: Array<EmissionEvent>): IEmission => {
	const next24h = getEmissionAmountBreakdownOverInterval(events, 0, 24 * 60 * 60)
	return {
		sources: [],
		protocolId: null,
		circSupply: 0,
		circSupply30d: 0,
		totalLocked: 0,
		maxSupply: 0,
		unlocksPerDay: next24h.total,
		next24h,
		token: `coingecko:${name.toLowerCase()}`,
		events,
		unlockEvents: null,
		lastEvent: [],
		historicalPrice: [],
		tSymbol: name.toUpperCase(),
		mcap: 1000,
		name,
		tPrice: 1,
		upcomingEvent: events
	}
}

const PROTOCOLS = [protocol('Alpha', [cliff('insiders')]), protocol('Beta', [cliff('airdrop')])]

let container: HTMLDivElement
let root: Root

const client = new QueryClient()
const table = () => (
	<QueryClientProvider client={client}>
		<RouterContext.Provider value={router()}>
			<UnlocksTable protocols={PROTOCOLS} showOnlyWatchlist={false} savedProtocols={new Set()} initialNowSec={0} />
		</RouterContext.Provider>
	</QueryClientProvider>
)

async function click(element: HTMLElement) {
	await act(async () => {
		element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }))
		element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0 }))
		element.click()
		await Promise.resolve()
	})
}

const typePicker = () => document.querySelector<HTMLButtonElement>('button[aria-label="Next Event Types dropdown"]')!

beforeEach(() => {
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	query = {}
	localStorage.clear()
})

test('a saved column pick that hid Name still shows Name, and the picker does not offer it', async () => {
	localStorage.setItem('unlockTable', JSON.stringify({ name: false, tPrice: true, mcap: false, totalLocked: false }))
	await act(async () => root.render(table()))
	expect(Array.from(container.querySelectorAll('thead th'), (header) => header.textContent)).toEqual([
		'Name',
		'Price',
		'Prev. Unlock Analysis',
		'7d Price Change After Unlock',
		'Next 24h Unlocks',
		'Next Event'
	])
	expect(container.querySelector('tbody')?.textContent).toContain('Alpha')

	await click(document.querySelector<HTMLButtonElement>('button[aria-label="Columns dropdown"]')!)
	expect(
		Array.from(
			document.querySelectorAll('[role="option"]:not([aria-label^="Only "])'),
			(option) => option.firstElementChild?.textContent
		)
	).toEqual([
		'Select all, some selected',
		'Price',
		'MCap',
		'Unlocked Supply',
		'Prev. Unlock Analysis',
		'7d Price Change After Unlock',
		'Next 24h Unlocks',
		'Next Event'
	])
})

test('clearing Select all in the event type picker selects no types and shows no protocols', async () => {
	await act(async () => root.render(table()))
	expect(typePicker().textContent).toBe('2Next Event Types')
	expect(container.textContent).toContain('Alpha')

	await click(typePicker())
	await click(
		[...document.querySelectorAll<HTMLElement>('[role="option"]')].find((option) =>
			option.textContent?.startsWith('Select all')
		)!
	)
	expect(query).toEqual({ unlockType: 'None' })
	expect(typePicker().textContent).toBe('0Next Event Types')
	expect(container.textContent).not.toContain('Alpha')
})
