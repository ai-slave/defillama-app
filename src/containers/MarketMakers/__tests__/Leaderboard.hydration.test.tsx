// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { renderHydrated } from '~/utils/testing/hydration'

vi.mock('next/router', () => ({ useRouter: () => ({ query: {}, pathname: '/market-makers/volume', push: () => {} }) }))

import { VOLUME_COLUMNS } from '../constants'
import { Leaderboard } from '../Leaderboard'

const fixtures = installFixtureFetch()

// The server and the browser each build their own query cache, as they do in production; a shared client would
// hand the hydrating render the server's cached rows.
function VolumeBoard() {
	const [client] = useState(() => new QueryClient())
	return (
		<QueryClientProvider client={client}>
			<Leaderboard
				active="Volume"
				title="Volume Leaderboard"
				subtitle="x"
				columns={VOLUME_COLUMNS}
				initialData={[{ marketMakerId: 'amber', marketMakerName: 'Amber', rank: null }]}
				fetchPath="volume"
			/>
		</QueryClientProvider>
	)
}

afterEach(() => {
	vi.useRealTimers()
})

test('a board built before UTC midnight and hydrated after it keeps the server rows', async () => {
	fixtures.serve({
		'/api/public/market-makers/volume': [{ marketMakerId: 'birch', marketMakerName: 'Birch', rank: null }]
	})
	// The visitor opens HTML the server built twenty minutes earlier, on the previous UTC day.
	vi.useFakeTimers({ toFake: ['Date'], now: Date.UTC(2026, 5, 30, 0, 10) })
	const rendered = await renderHydrated(<VolumeBoard />, { pageClockSec: Date.UTC(2026, 5, 29, 23, 50) / 1000 })
	try {
		expect(rendered.serverHtml).toContain('Amber')
		expect(rendered.errors).toEqual([])
	} finally {
		await rendered.unmount()
	}
})
