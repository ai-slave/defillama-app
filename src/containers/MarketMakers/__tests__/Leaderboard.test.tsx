// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'

vi.mock('next/router', () => ({ useRouter: () => ({ query: {}, pathname: '/market-makers/volume', push: () => {} }) }))

import { VOLUME_COLUMNS } from '../constants'
import { Leaderboard } from '../Leaderboard'

const fixtures = installFixtureFetch()

afterEach(() => {
	vi.useRealTimers()
	window.localStorage.clear()
})

test('a board saved on the 7-day timeframe shows the 7-day badge and that window’s rows', async () => {
	vi.useFakeTimers({ toFake: ['Date'] })
	vi.setSystemTime(new Date(Date.UTC(2026, 5, 29)))
	window.localStorage.setItem('mm-timeframe-volume', 'Prev. 7d')
	fixtures.serve({
		'/api/public/market-makers/volume': [{ marketMakerId: 'birch', marketMakerName: 'Birch', rank: null }]
	})
	const initialData = [{ marketMakerId: 'amber', marketMakerName: 'Amber', rank: null }]

	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	try {
		await act(async () =>
			root.render(
				<QueryClientProvider client={new QueryClient()}>
					<Leaderboard
						active="Volume"
						title="Volume Leaderboard"
						subtitle="x"
						columns={VOLUME_COLUMNS}
						initialData={initialData}
						fetchPath="volume"
					/>
				</QueryClientProvider>
			)
		)
		await vi.waitFor(() => expect(container.textContent).toContain('Birch'), { timeout: 1000 })

		expect(container.textContent).toContain('Last 7-day')
		expect(container.textContent).not.toContain('Amber')
		const url = new URL(fixtures.urls()[0])
		expect([url.searchParams.get('start_date'), url.searchParams.get('end_date')]).toEqual(['2026-06-22', '2026-06-29'])
	} finally {
		await act(async () => root.unmount())
		container.remove()
	}
})
