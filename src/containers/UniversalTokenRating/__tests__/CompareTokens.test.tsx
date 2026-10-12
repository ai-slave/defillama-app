import type { ParsedUrlQuery } from 'node:querystring'
// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installChartCanvas } from '~/utils/testing/chartCanvas'
import { pickOption } from '~/utils/testing/pickOption'
import { CompareTokens } from '../CompareTokens'
import type { UtrLeaderboardRow, UtrUniverse } from '../types'

const router = vi.hoisted(() => ({
	pathname: '/universal-token-rating/compare',
	asPath: '/universal-token-rating/compare',
	query: {} as ParsedUrlQuery,
	push: vi.fn()
}))
vi.mock('next/router', () => ({ default: router, useRouter: () => router }))

function row(asset: string, name: string, symbol: string): UtrLeaderboardRow {
	return {
		asset,
		name,
		symbol,
		sector: 'DeFi',
		listingStatus: 'listed',
		disclosureLevel: 'full',
		claimed: false,
		fdvUsd: 100,
		grade: 'AAA',
		scores: {
			overall: 60,
			overallMomChangePct: 2,
			disclosure: 8,
			performance: 7.5,
			rank: 1,
			disclosureRubrics: [],
			performanceRubrics: []
		}
	}
}

const universe: UtrUniverse = {
	rows: [row('pyth-network', 'Pyth Network', 'PYTH'), row('uniswap', 'Uniswap', 'UNI'), row('aave', 'Aave', 'AAVE')],
	scoredCount: 3,
	totalCount: 3
}

let root: Root
let container: HTMLDivElement
// Each picked column draws the performance matrix, a real ECharts scatter that needs a canvas.
beforeEach(() => {
	installChartCanvas()
	router.push.mockClear()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

/** Opens the page at `query`. A fresh root, because the mock router cannot re-render the page the way Next's does. */
async function open(query: ParsedUrlQuery) {
	await act(async () => root.unmount())
	root = createRoot(container)
	router.query = query
	await act(async () =>
		root.render(
			<QueryClientProvider client={new QueryClient()}>
				<CompareTokens universe={universe} scoringConfig={null} />
			</QueryClientProvider>
		)
	)
}

/** The token picker of the column labeled `column`, such as `Token B`. */
function picker(column: string) {
	const label = [...container.querySelectorAll('span')].find((span) => span.textContent === `${column}:`)!
	return label.parentElement!.querySelector<HTMLElement>('button')!
}

test('both picks write to the URL and a link with that query opens the same pair', async () => {
	await open({})
	// Token B can be picked before Token A.
	await pickOption(picker('Token B'), 'Uniswap (UNI)')
	expect(router.push.mock.lastCall![0].query).toEqual({ vs: 'uniswap' })

	await open({ vs: 'uniswap' })
	expect(picker('Token B').textContent).toContain('Uniswap (UNI)')
	await pickOption(picker('Token A'), 'Aave (AAVE)')
	expect(router.push.mock.lastCall![0].query).toEqual({ vs: 'uniswap', token: 'aave' })

	await open({ token: 'aave', vs: 'uniswap' })
	expect(picker('Token A').textContent).toContain('Aave (AAVE)')
	expect(picker('Token B').textContent).toContain('Uniswap (UNI)')
	expect(container.textContent).not.toContain('No token selected')
})

test('a leaderboard Compare link fills Token A and leaves Token B to pick', async () => {
	await open({ token: 'pyth-network' })
	expect(picker('Token A').textContent).toContain('Pyth Network (PYTH)')
	expect(picker('Token B').textContent).toContain('Select a Token')
	expect(container.textContent).toContain('No token selected')
})
