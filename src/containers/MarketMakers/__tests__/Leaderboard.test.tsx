import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'

vi.mock('next/router', () => ({ useRouter: () => ({ query: {}, pathname: '/market-makers/volume', push: () => {} }) }))
vi.mock('../MarketMakersTabs', () => ({ MarketMakersTabs: () => <div>tabs</div> }))
vi.mock('../RankTable', () => ({ RankTable: ({ rows }: { rows: Array<unknown> }) => <div>rows:{rows.length}</div> }))
vi.mock('../RankTable/RefineDrawer', () => ({ RefineDrawer: () => null }))
vi.mock('../MMDetailDrawer', () => ({ MMDetailDrawer: () => null }))
vi.mock('../client', () => ({
	useLeaderboardRows: (_p: string, _r: unknown, initial: Array<unknown>) => ({ data: initial, isLoading: false })
}))

import { VOLUME_COLUMNS } from '../constants'
import { Leaderboard } from '../Leaderboard'

describe('Leaderboard', () => {
	test('renders the title, derives the badge from the default timeframe, and forwards rows to the table', () => {
		const rows = [{ marketMakerId: 'a', marketMakerName: 'A', marketMakerImageUrl: null, rank: null, metrics: {} }]
		const html = renderToStaticMarkup(
			<Leaderboard
				active="Volume"
				title="Volume Leaderboard"
				subtitle="x"
				columns={VOLUME_COLUMNS}
				initialData={rows}
				fetchPath="volume"
			/>
		)
		expect(html).toContain('Volume Leaderboard')
		expect(html).toContain('Last 30-day')
		expect(html).toContain('rows:1')
	})
})
