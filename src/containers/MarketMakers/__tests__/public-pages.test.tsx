import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import { AuthProvider } from '~/auth'

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/', asPath: '/', query: {} }) }))

import DepthLeaderboard from '~/pages/market-makers/depth'
import MarketMakersDocumentationPage from '~/pages/market-makers/documentation'
import MarketMakersPerformanceIndex from '~/pages/market-makers/index'
import KpiLeaderboard from '~/pages/market-makers/kpi'
import SpreadLeaderboard from '~/pages/market-makers/spread'
import VolumeLeaderboard from '~/pages/market-makers/volume'

function renderPage<Props extends object>(Component: ComponentType<Props>, props: Props) {
	const client = new QueryClient()
	try {
		const html = renderToStaticMarkup(
			<QueryClientProvider client={client}>
				<AuthProvider>
					<Component {...props} />
				</AuthProvider>
			</QueryClientProvider>
		)
		return html.match(/<main[^>]*>([\s\S]*?)<\/main>/)![1].replace(/<[^>]*>/g, '')
	} finally {
		client.clear()
	}
}

describe('public Market Makers pages', () => {
	test('renders every route without an auth or preview access gate', () => {
		expect(renderPage(MarketMakersPerformanceIndex, { performanceRows: [], aggregated: {} })).toContain(
			'Performance Index'
		)
		expect(renderPage(MarketMakersDocumentationPage, {})).toContain('Documentation')
		expect(renderPage(DepthLeaderboard, { payload: null })).toContain('Depth Leaderboard')
		expect(renderPage(VolumeLeaderboard, { rows: [] })).toContain('Volume Leaderboard')
		expect(renderPage(SpreadLeaderboard, { rows: [] })).toContain('Spread Leaderboard')
		expect(renderPage(KpiLeaderboard, { rows: [] })).toContain('KPI Adherence Leaderboard')
	})
})
