// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import { DashboardTestProvider } from '~/utils/testing/dashboardContext'
import { alertTexts } from '~/utils/testing/fieldErrors'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'
import { getChartBuilderQueryKey } from '../../chartBuilderQueryKey'
import type { ChartBuilderConfig } from '../../types'
import { ChartBuilderCard } from '../ChartBuilderCard'

const http = installFixtureFetch()

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/pro/test' }) }))
// The chart itself is not under test here; its canvas cannot run in happy-dom.
vi.mock('~/components/ECharts/MultiSeriesChart', () => ({ default: () => null }))

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

		expect(html).toContain('Loading chart')
		expect(html).not.toContain('No data available')
	})

	test('shows no data after the stream provides a completed empty result', () => {
		const queryClient = new QueryClient()
		queryClient.setQueryData(queryKey, { series: [] })
		const html = renderCard(queryClient)

		expect(html).not.toContain('Loading chart')
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
		await waitForUi(() => expect(alertTexts(container)).toHaveLength(1))
		expect(alertTexts(container)[0]).not.toContain('network down')
		expect(Array.from(container.querySelectorAll('button')).some((b) => b.textContent === 'Try again')).toBe(true)

		await act(async () => root.unmount())
		container.remove()
	})
})

test('series color Reset buttons stay focusable while there is no override to reset', async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	const queryClient = new QueryClient()
	const day = Math.floor(Date.now() / 1000 / 86_400) * 86_400
	queryClient.setQueryData(queryKey, { series: [{ name: 'Aave', data: [[day * 1000, 5]], color: '#123456' }] })
	const container = document.createElement('div')
	document.body.appendChild(container)
	const root = createRoot(container)
	await act(async () =>
		root.render(
			<QueryClientProvider client={queryClient}>
				<DashboardTestProvider mode="edit" time={{ timePeriod: 'all' }}>
					<ChartBuilderCard builder={builder} />
				</DashboardTestProvider>
			</QueryClientProvider>
		)
	)
	const button = (label: string) => [...container.querySelectorAll('button')].find((el) => el.textContent === label)!
	await act(async () => button('Colors').click())
	for (const label of ['Reset', 'Reset All']) {
		expect(button(label).disabled).toBe(false)
		expect(button(label).getAttribute('aria-disabled')).toBe('true')
	}
	await act(async () => root.unmount())
	container.remove()
})
