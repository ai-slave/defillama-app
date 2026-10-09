// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { UtrLeaderboardRow, UtrUniverse } from '../types'

const router = vi.hoisted(() => ({
	pathname: '/universal-token-rating',
	asPath: '/universal-token-rating',
	query: {} as Record<string, string | Array<string>>,
	push: vi.fn()
}))
vi.mock('next/router', () => ({ useRouter: () => router }))

import { installChartCanvas } from '~/utils/testing/chartCanvas'
import { UniversalTokenRating } from '..'

const sectors = ['L1', 'DeFi', 'Gaming']
const rows: Array<UtrLeaderboardRow> = sectors.map((sector, index) => ({
	asset: `asset-${index}`,
	name: `Protocol ${index}`,
	symbol: `P${index}`,
	sector,
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
let client: QueryClient
const page = () => (
	<QueryClientProvider client={client}>
		<UniversalTokenRating universe={universe} topMovers={[]} scoringConfig={null} />
	</QueryClientProvider>
)

// A shallow push lands the new query after the click, as Next renders it.
router.push.mockImplementation(async ({ query }: { query: Record<string, string | Array<string>> }) => {
	router.query = query
	root.render(page())
	return true
})

beforeEach(() => {
	// The leaderboard draws the performance matrix, a real ECharts scatter that needs a canvas.
	installChartCanvas()
	client = new QueryClient()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})

afterEach(async () => {
	vi.restoreAllMocks()
	await act(async () => root.unmount())
	container.remove()
	client.clear()
	router.query = {}
})

const chip = (name: string) =>
	[...container.querySelectorAll('button')].find((button) => button.textContent === `Remove ${name}`)

async function removeChip(name: string) {
	await act(async () => {
		chip(name)!.focus()
		chip(name)!.click()
	})
}

test('removing a filter chip hands focus to the next chip, then to the Filter button', async () => {
	router.query = { sector: ['L1', 'DeFi'] }
	await act(async () => root.render(page()))

	await removeChip('DeFi')
	expect(chip('DeFi')).toBeUndefined()
	expect(document.activeElement).toBe(chip('L1'))

	router.query = { sector: ['L1', 'DeFi'] }
	await act(async () => root.render(page()))
	await removeChip('L1')
	expect(document.activeElement).toBe(chip('DeFi'))

	await removeChip('DeFi')
	expect(document.activeElement?.textContent).toMatch(/^Filter/)
})
