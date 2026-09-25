// @vitest-environment node
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import type { DashboardItemConfig } from '~/containers/ProDashboard/dashboardItemConfig'

vi.mock('~/server/db/llama', () => ({ llamaDb: {} }))
// Card bodies and the grid are heavy children; these tests read the embed frame around them.
vi.mock('~/containers/ProDashboard/components/ChartGrid', () => ({
	ChartGrid: () => 'Whole dashboard grid',
	DashboardCardStreamScope: ({ children }: { children: ReactNode }) => children,
	DashboardItemRenderer: () => null
}))
vi.mock('next/router', () => ({ useRouter: () => ({ query: {}, asPath: '/pro/embed/fees-dash', isReady: true }) }))

import { AuthProvider } from '~/auth'
import DashboardEmbedPage from '~/pages/pro/embed/[dashboardId]'

const chartItem: DashboardItemConfig = {
	id: 'chart-1',
	kind: 'chart',
	subjectType: 'protocol',
	protocol: 'aave',
	type: 'fees'
}

const initialDashboard = {
	id: 'dashboard-1',
	slug: 'fees-dash',
	visibility: 'public' as const,
	tags: ['fees'],
	description: 'Public dashboard description',
	created: '2026-01-01T00:00:00.000Z',
	updated: '2026-01-02T00:00:00.000Z',
	data: { dashboardName: 'Public Fees Dashboard', items: [chartItem] }
}

function renderEmbed(itemId: string | null) {
	return renderToStaticMarkup(
		<QueryClientProvider client={new QueryClient()}>
			<AuthProvider>
				<DashboardEmbedPage initialDashboard={initialDashboard} itemId={itemId} theme="dark" />
			</AuthProvider>
		</QueryClientProvider>
	)
}

describe('pro dashboard embed page', () => {
	test('a single-card embed frames that card and links back to the dashboard', () => {
		const markup = renderEmbed('chart-1')

		expect(markup).toContain('id="item-chart-1"')
		expect(markup).toContain('Open on DefiLlama')
		expect(markup).toContain('href="/pro/fees-dash"')
		expect(markup).toContain('Public Fees Dashboard')
		expect(markup).not.toContain('Card not found')
	})

	test('a whole-dashboard embed renders the grid instead of a single card', () => {
		const markup = renderEmbed(null)

		expect(markup).toContain('Whole dashboard grid')
		expect(markup).toContain('Open on DefiLlama')
		expect(markup).not.toContain('id="item-')
	})

	test('an unknown card shows a not-found fallback linking to the dashboard', () => {
		const markup = renderEmbed('gone')

		expect(markup).toContain('Card not found')
		expect(markup).toContain('Open the dashboard')
		expect(markup).not.toContain('id="item-')
	})
})
