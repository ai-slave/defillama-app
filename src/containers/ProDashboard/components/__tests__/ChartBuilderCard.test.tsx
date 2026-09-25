// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import { DashboardTestProvider } from '~/utils/testing/dashboardContext'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { getChartBuilderQueryKey } from '../../chartBuilderQueryKey'
import type { ChartBuilderConfig } from '../../types'
import { ChartBuilderCard } from '../ChartBuilderCard'

const http = installFixtureFetch()

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/pro/test' }) }))

const config: ChartBuilderConfig['config'] = {
	categories: [],
	chainCategories: [],
	chainCategoryFilterMode: 'include',
	chainFilterMode: 'include',
	chains: ['All'],
	chartType: 'stackedBar',
	displayAs: 'timeSeries',
	categoryFilterMode: 'include',
	groupBy: 'protocol',
	groupByParent: true,
	hideOthers: true,
	limit: 10,
	metric: 'revenue',
	mode: 'chains',
	protocolCategories: [],
	protocolCategoryFilterMode: 'include'
}

const builder: ChartBuilderConfig = {
	id: 'builder-revenue',
	kind: 'builder',
	name: 'Top Revenue Protocols',
	grouping: 'week',
	config
}

const queryKey = getChartBuilderQueryKey(config)

function Card({ queryClient, streamDone }: { queryClient: QueryClient; streamDone: boolean }) {
	return (
		<QueryClientProvider client={queryClient}>
			<DashboardTestProvider
				mode="view"
				streamDone={streamDone}
				time={{ timePeriod: '3y' }}
				permissions={{ isReadOnly: true, hideDuplicateButton: true }}
			>
				<ChartBuilderCard builder={builder} />
			</DashboardTestProvider>
		</QueryClientProvider>
	)
}

function renderCard(queryClient: QueryClient) {
	return renderToStaticMarkup(<Card queryClient={queryClient} streamDone={false} />)
}

describe('ChartBuilderCard streamed loading state', () => {
	test('shows loading before the stream has provided a cache entry', () => {
		const html = renderCard(new QueryClient())

		expect(html).toContain('Loading chart…')
		expect(html).not.toContain('No data available')
	})

	test('shows no data after the stream provides a completed empty result', () => {
		const queryClient = new QueryClient()
		queryClient.setQueryData(queryKey, { series: [] })
		const html = renderCard(queryClient)

		expect(html).not.toContain('Loading chart…')
		expect(html).toContain('No data available')
	})

	test('shows an error with retry when the series query fails', async () => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		http.serve({
			'/api/public/pro-dashboard/chart-builder/adapter-metrics/breakdowns/revenue': fixtureStatus(503, {
				error: 'network down'
			})
		})
		const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
		const container = document.createElement('div')
		document.body.appendChild(container)
		const root = createRoot(container)

		await act(async () => root.render(<Card queryClient={queryClient} streamDone />))
		await vi.waitFor(() => {
			if (!container.querySelector('[role="alert"]')) throw new Error('Expected the card error')
		})

		const alert = container.querySelector('[role="alert"]')
		expect(alert?.textContent).toContain("Couldn't load this card")
		expect(alert?.textContent).not.toContain('network down')
		expect(Array.from(container.querySelectorAll('button')).some((b) => b.textContent === 'Try again')).toBe(true)

		await act(async () => root.unmount())
		container.remove()
	})
})
