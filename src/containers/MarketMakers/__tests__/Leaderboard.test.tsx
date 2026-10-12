import type { ParsedUrlQuery } from 'node:querystring'
// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { accessibleName } from '~/utils/testing/accessibleName'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'

const router = vi.hoisted(() => ({ pathname: '/market-makers/depth', query: {} as ParsedUrlQuery, push: vi.fn() }))
vi.mock('next/router', () => ({ default: router, useRouter: () => router }))

import { DEPTH_COLUMNS, VOLUME_COLUMNS } from '../constants'
import { Leaderboard } from '../Leaderboard'

const fixtures = installFixtureFetch()
const row = (id: string) => ({ marketMakerId: id, marketMakerName: id, rank: null })

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	router.push.mockClear()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	vi.useRealTimers()
	await act(async () => root.unmount())
	container.remove()
})

/** Opens the board at `query`. A fresh root, because the mock router cannot re-render the page the way Next's does. */
async function open(board: 'volume' | 'depth', query: ParsedUrlQuery, initialData: unknown) {
	await act(async () => root.unmount())
	root = createRoot(container)
	router.query = query
	await act(async () =>
		root.render(
			<QueryClientProvider client={new QueryClient()}>
				<Leaderboard
					active={board === 'depth' ? 'Depth' : 'Volume'}
					title="Leaderboard"
					subtitle="x"
					columns={board === 'depth' ? DEPTH_COLUMNS : VOLUME_COLUMNS}
					initialData={initialData}
					fetchPath={board}
					hasThreshold={board === 'depth'}
				/>
			</QueryClientProvider>
		)
	)
}

function radio(group: string, name: string) {
	const radios = document.querySelectorAll<HTMLInputElement>(`[aria-label="${group}"] input[type="radio"]`)
	return [...radios].find((input) => accessibleName(input) === name)!
}

function button(name: string) {
	return [...document.querySelectorAll('button')].find((element) => accessibleName(element) === name)!
}

/** The query the last click pushed, which the next `open` reads back. */
function pushedQuery() {
	return router.push.mock.lastCall![0].query as ParsedUrlQuery
}

test('a link with a 7-day period shows the 7-day badge and that window’s rows', async () => {
	vi.useFakeTimers({ toFake: ['Date'] })
	vi.setSystemTime(new Date(Date.UTC(2026, 5, 29)))
	fixtures.serve({ '/api/public/market-makers/volume': [row('Birch')] })

	await open('volume', { period: '7d' }, [row('Amber')])
	await waitForUi(() => expect(container.textContent).toContain('Birch'), { timeout: 1000 })

	expect(container.textContent).toContain('Last 7-day')
	expect(container.textContent).not.toContain('Amber')
	const url = new URL(fixtures.urls()[0])
	expect([url.searchParams.get('start_date'), url.searchParams.get('end_date')]).toEqual(['2026-06-22', '2026-06-29'])
})

test('timeframe, Show as and threshold write their pick to the URL and read it back', async () => {
	const buckets = { depth50: [row('Half')], depth100: [row('One')], depth200: [row('Two')] }
	fixtures.serve({ '/api/public/market-makers/depth': buckets })
	await open('depth', {}, buckets)
	expect(container.textContent).toContain('Two')

	await act(async () => radio('Show as', 'Percentile').click())
	await act(async () => button('Refine leaderboard').click())
	await act(async () => radio('Timeframe', 'Prev. 30d').click())
	await act(async () => radio('Timeframe', 'Prev. 60d').click())
	expect(router.push.mock.calls.map(([url]) => url.query)).toEqual([{ showAs: 'percentile' }, { period: '60d' }])

	await open('depth', { showAs: 'percentile', threshold: '1' }, buckets)
	expect(radio('Show as', 'Percentile').checked).toBe(true)
	expect(container.textContent).toContain('One')
	expect(container.textContent).not.toContain('Two')

	// Picking the default removes its key, so the plain route stays the default view.
	await act(async () => radio('Show as', 'Value').click())
	expect(pushedQuery()).toEqual({ threshold: '1' })
})

test('an unknown value in a leaderboard link opens the default', async () => {
	fixtures.serve({ '/api/public/market-makers/depth': { depth200: [row('Two')] } })
	await open('depth', { period: '90d', showAs: 'heatmap', threshold: '5' }, { depth200: [row('Two')] })
	expect(container.textContent).toContain('Last 30-day')
	expect(radio('Show as', 'Value').checked).toBe(true)
	expect(container.textContent).toContain('Two')
})
