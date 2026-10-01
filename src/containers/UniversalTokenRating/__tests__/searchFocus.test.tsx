// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { UtrLeaderboardRow, UtrUniverse } from '../types'

const router = vi.hoisted(() => ({
	pathname: '/universal-token-rating',
	asPath: '/universal-token-rating',
	query: {} as Record<string, string | Array<string>>,
	push: vi.fn()
}))
vi.mock('next/router', () => ({ useRouter: () => router }))

import { UniversalTokenRating } from '..'

// The first 100 ranks are L1 tokens and the rest DeFi, so a sector filter moves a DeFi token to another page.
const rows: Array<UtrLeaderboardRow> = Array.from({ length: 205 }, (_, index) => ({
	asset: `asset-${index}`,
	name: `Protocol ${index}`,
	symbol: `P${index}`,
	sector: index < 100 ? 'L1' : 'DeFi',
	listingStatus: 'listed',
	disclosureLevel: 'full',
	claimed: false,
	fdvUsd: 10_000_000,
	grade: 'AAA',
	scores: {
		overall: 60,
		overallMomChangePct: 2,
		disclosure: 8,
		performance: 7.5,
		rank: index,
		disclosureRubrics: [],
		performanceRubrics: []
	}
}))
const universe: UtrUniverse = { rows, scoredCount: rows.length, totalCount: rows.length }

let container: HTMLDivElement
let root: Root
let scrolledTo: Array<string>
// The performance matrix loads its icons through React Query, as _app provides.
let client: QueryClient
const page = () => (
	<QueryClientProvider client={client}>
		<UniversalTokenRating universe={universe} topMovers={[]} scoringConfig={null} />
	</QueryClientProvider>
)

// Next resolves a shallow push only after the page has rendered the new query, well after the click's own
// updates. The test lands each push itself, in that order.
let landPush: () => Promise<void>
router.push.mockImplementation(
	({ query }: { query: Record<string, string | Array<string>> }) =>
		new Promise<boolean>((resolve) => {
			landPush = async () => {
				await act(async () => {
					router.query = query
					root.render(page())
				})
				await act(async () => resolve(true))
			}
		})
)

beforeEach(() => {
	client = new QueryClient()
	scrolledTo = []
	// happy-dom has no layout, so scrolling only records which row was brought into view.
	Element.prototype.scrollIntoView = function (this: Element) {
		scrolledTo.push(this.id)
	}
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	client.clear()
	router.query = {}
})

async function search(text: string) {
	const input = container.querySelector<HTMLInputElement>('input[placeholder="Search token or ticker"]')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, text)
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
	await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Find token in leaderboard"]')!.click())
}

const pageLabel = () =>
	[...container.querySelectorAll('span')].find((span) => span.textContent!.startsWith('Page '))!.textContent
const onPage = (asset: string) => document.getElementById(`utr-row-${asset}`) != null

describe('leaderboard search', () => {
	test('a token the filters hide is shown and scrolled to once the filters reset', async () => {
		router.query = { sector: 'L1' }
		await act(async () => root.render(page()))
		expect(onPage('asset-150')).toBe(false)

		await search('Protocol 150')

		await landPush()
		expect(router.query).toEqual({})
		expect(pageLabel()).toBe('Page 2 of 3')
		expect(onPage('asset-150')).toBe(true)
		expect(scrolledTo).toEqual(['utr-row-asset-150'])
	})

	test('a token on another page of the filtered rows lands on its page once the filters reset', async () => {
		router.query = { sector: 'DeFi' }
		await act(async () => root.render(page()))
		// Filtered to DeFi, asset-150 is the 51st row and sits on the first page.
		expect(onPage('asset-150')).toBe(true)

		await search('Protocol 150')

		await landPush()
		expect(router.query).toEqual({})
		expect(pageLabel()).toBe('Page 2 of 3')
		expect(onPage('asset-150')).toBe(true)
		expect(scrolledTo).toEqual(['utr-row-asset-150'])
	})

	test('searching without filters pages to the token and scrolls to it', async () => {
		await act(async () => root.render(page()))

		await search('Protocol 204')

		await landPush()
		expect(pageLabel()).toBe('Page 3 of 3')
		expect(scrolledTo).toEqual(['utr-row-asset-204'])
	})

	test('text typed before the page hydrates is kept, and Find takes the reader to that token', async () => {
		// The static HTML arrives first; the reader types into it before React attaches.
		await act(async () => root.unmount())
		container.innerHTML = renderToString(page())
		const input = container.querySelector<HTMLInputElement>('input[placeholder="Search token or ticker"]')!
		input.value = 'Protocol 204'
		await act(async () => {
			root = hydrateRoot(container, page())
		})
		expect(container.querySelector<HTMLInputElement>('input[placeholder="Search token or ticker"]')!.value).toBe(
			'Protocol 204'
		)

		await act(async () =>
			container.querySelector<HTMLButtonElement>('[aria-label="Find token in leaderboard"]')!.click()
		)

		await landPush()
		expect(pageLabel()).toBe('Page 3 of 3')
		expect(scrolledTo).toEqual(['utr-row-asset-204'])
	})
})
