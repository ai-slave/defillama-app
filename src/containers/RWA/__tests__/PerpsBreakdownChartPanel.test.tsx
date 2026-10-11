// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { alertTexts } from '~/utils/testing/fieldErrors'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { settleQueries } from '~/utils/testing/settleQueries'
import type { IRWAPerpsMarket } from '../Perps/api.types'
import { RWAPerpsBreakdownChartPanel, type RWAPerpsBreakdownChartPanelProps } from '../PerpsBreakdownChartPanel'
import { toRWAPerpsContractOverlayRow } from '../perpsOverlay'

const router = vi.hoisted(() => ({
	query: {} as Record<string, string | Array<string>>,
	pathname: '/rwa/perps',
	asPath: '/rwa/perps',
	push: vi.fn(async () => true)
}))
vi.mock('next/router', () => ({ useRouter: () => router }))

// ECharts cannot draw in happy-dom; what the chart draws is owned by chartSeries.test.ts.
vi.mock('~/components/ECharts/MultiSeriesChart', () => ({ default: () => null }))

const http = installFixtureFetch()

const market = (id: string, venue: string): ReturnType<typeof toRWAPerpsContractOverlayRow> =>
	toRWAPerpsContractOverlayRow({
		id,
		contract: id,
		venue,
		venueType: 'DEX',
		parentPlatform: venue,
		referenceAsset: id,
		referenceAssetGroup: 'Equities',
		assetClass: ['Stock Perp'],
		openInterest: 1
	} as IRWAPerpsMarket)

const markets = [market('xyz:TSLA', 'trade[XYZ]'), market('xyz:AAPL', 'trade[XYZ]'), market('ost:TSLA', 'Ostium')]
const DAY = 86_400_000

let container: HTMLDivElement
let root: Root
let client: QueryClient

beforeEach(() => {
	router.query = {}
	router.push.mockClear()
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	client.clear()
	container.remove()
	vi.restoreAllMocks()
})

async function render(props: Partial<RWAPerpsBreakdownChartPanelProps> = {}) {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<RWAPerpsBreakdownChartPanel
					scope={{ kind: 'all' }}
					groupBy="platform"
					includeCex={false}
					markets={markets}
					isFiltered={false}
					title="RWA Perps"
					pageKind="perpsOverview"
					slug={null}
					{...props}
				/>
			</QueryClientProvider>
		)
	)
}

/** The routes the panel loaded, with the query our logic chose. */
async function loadedRoutes(): Promise<Array<string>> {
	await settleQueries(client)
	return http.requests.map((request) => `${request.url.pathname}${request.url.search}`)
}

/** A segmented control option, by its aria label or the label it sits in. */
function radio(name: string): HTMLInputElement {
	const found = [...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')].find(
		(input) => input.getAttribute('aria-label') === name || input.closest('label')?.textContent?.trim() === name
	)
	if (!found) throw new Error(`no option named ${name}`)
	return found
}

describe('RWAPerpsBreakdownChartPanel', () => {
	test('under a filter the chart loads the per-market history instead of the server split', async () => {
		http.serve({
			'/api/public/rwa/perps/contract-breakdown': {
				dimensions: ['timestamp', 'xyz:TSLA', 'xyz:AAPL', 'ost:TSLA'],
				source: [{ timestamp: DAY, 'xyz:TSLA': 5, 'xyz:AAPL': 7, 'ost:TSLA': 2 }]
			}
		})
		await render({ isFiltered: true, markets: markets.filter((row) => row.id !== 'xyz:AAPL') })

		expect(await loadedRoutes()).toEqual(['/api/public/rwa/perps/contract-breakdown?key=openInterest'])
	})

	test('a filter that matches no market says so instead of drawing an empty plot', async () => {
		http.serve({
			'/api/public/rwa/perps/contract-breakdown': {
				dimensions: ['timestamp', 'xyz:TSLA'],
				source: [{ timestamp: DAY, 'xyz:TSLA': 5 }]
			}
		})
		await render({ isFiltered: true, markets: [] })
		await settleQueries(client)

		expect(container.querySelector('[role="status"]')).not.toBeNull()
		expect(alertTexts(container)).toEqual([])
	})

	test('unfiltered it loads the server split, and the volume period is written under flowMode', async () => {
		router.query = { chartType: 'volume' }
		http.serve({
			'/api/public/rwa/perps/overview-breakdown': {
				dimensions: ['timestamp', 'trade[XYZ]'],
				source: [{ timestamp: DAY, 'trade[XYZ]': 4 }]
			}
		})
		await render()
		expect(await loadedRoutes()).toEqual(['/api/public/rwa/perps/overview-breakdown?breakdown=venue&key=volume24h'])

		await act(async () => radio('Weekly').click())
		expect(router.push).toHaveBeenLastCalledWith(
			{ pathname: '/rwa/perps', query: { chartType: 'volume', flowMode: 'weekly' } },
			undefined,
			{ shallow: true }
		)
	})

	test('a new metric drops the series pick, whose members belonged to the old split', async () => {
		router.query = { excludeChartSeries: 'Ostium' }
		http.serve({
			'/api/public/rwa/perps/overview-breakdown': {
				dimensions: ['timestamp', 'trade[XYZ]', 'Ostium'],
				source: [{ timestamp: DAY, 'trade[XYZ]': 4, Ostium: 1 }]
			}
		})
		await render()
		await loadedRoutes()

		await act(async () => radio('Volume').click())
		expect(router.push).toHaveBeenLastCalledWith(
			{ pathname: '/rwa/perps', query: { chartType: 'volume' } },
			undefined,
			{ shallow: true }
		)
	})
})
