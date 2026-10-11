// @vitest-environment happy-dom
import type { ParsedUrlQuery } from 'node:querystring'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { accessibleName } from '~/utils/testing/accessibleName'
import type { IEquitiesSectorApiItem, IEquitiesSectorOverviewApiResponse } from '../api.types'
import { IndustriesPage } from '../IndustriesPage'
import { SectorsPage } from '../SectorsPage'
import { industry } from './aggregateFixture'

const router = vi.hoisted(() => ({ pathname: '/equities/sectors', query: {} as ParsedUrlQuery, push: vi.fn() }))
vi.mock('next/router', () => ({ default: router, useRouter: () => router }))
// The charts draw on canvas and nothing here asserts on them.
vi.mock('~/components/ECharts/TreemapChart', () => ({ default: () => null }))
vi.mock('~/components/ECharts/HBarChart', () => ({ default: () => null }))
vi.mock('~/components/ECharts/MultiSeriesChart', () => ({ default: () => null }))

const returns = {
	priceChangePercentage1d: 1,
	priceChangePercentage7d: 2,
	priceChangePercentage1m: 3,
	priceChangePercentage3m: 4,
	priceChangePercentage6m: 5,
	priceChangePercentageYtd: 6,
	priceChangePercentage1y: 7
}
const valuation = {
	trailingPE: 20,
	priceToRevenue: null,
	priceToBook: null,
	enterpriseValueToEbitda: null,
	operatingProfitMarginTTM: null,
	dividendYield: null,
	earningsYield: null
}
const technology = { sector: 'Technology', sectorSlug: 'technology' }
const sector: IEquitiesSectorApiItem = {
	...returns,
	...valuation,
	...technology,
	industryCount: 1,
	rank: 1,
	marketCap: 2,
	marketCapChange1d: null,
	dollarVolume24h: 1,
	dollarVolumeShare24h: null,
	revenueTTM: 1,
	earningsTTM: null,
	ebitdaTTM: null,
	enterpriseValue: null,
	employeeCount: null,
	holdersYield: null,
	companyCount: 1,
	weight: 1,
	topHoldings: [],
	coverage: {},
	updatedAt: '2026-10-09T00:00:00Z',
	volumeAsOf: '2026-10-09T00:00:00Z'
}
const overview: IEquitiesSectorOverviewApiResponse = {
	...returns,
	...valuation,
	marketCap: 2,
	marketCapChange1d: null,
	dollarVolume24h: 1,
	revenueTTM: 1,
	earningsTTM: null,
	ebitdaTTM: null,
	employeeCount: null,
	companyCount: 1,
	sectorCount: 1,
	industryCount: 1,
	bestSector1d: { ...technology, priceChangePercentage1d: 1 },
	worstSector1d: { ...technology, priceChangePercentage1d: 1 },
	largestSector: { ...technology, weight: 1 }
}
const sectorsPage = <SectorsPage state={{ status: 'ready', stale: false, data: { overview, sectors: [sector] } }} />
const industriesPage = (
	<IndustriesPage
		state={{
			status: 'ready',
			stale: false,
			data: {
				overview: { marketCap: 2, companyCount: 1, sectorCount: 1 },
				industries: [{ ...industry(), updatedAt: '2026-10-09T00:00:00Z' }]
			}
		}}
	/>
)

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	router.push.mockClear()
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

/** Opens the page at `query`. A fresh root, because the mock router cannot re-render the page the way Next's does. */
async function open(page: ReactNode, query: ParsedUrlQuery) {
	await act(async () => root.unmount())
	root = createRoot(container)
	router.query = query
	await act(async () => root.render(page))
}

function radio(group: string, name: string) {
	const radios = container.querySelectorAll<HTMLInputElement>(`[aria-label="${group}"] input[type="radio"]`)
	return [...radios].find((input) => accessibleName(input) === name)!
}

/** The query the last click pushed, which the next `open` reads back. */
function pushedQuery() {
	return router.push.mock.lastCall![0].query as ParsedUrlQuery
}

test('sector page controls write their pick to the URL and read it back', async () => {
	await open(sectorsPage, {})
	expect(radio('Sector performance period', '1D').checked).toBe(true)

	await act(async () => radio('Sector performance period', 'YTD').click())
	await act(async () => radio('Treemap size', 'Volume').click())
	await act(async () => radio('Sort sector cards', 'P/E').click())
	expect(router.push.mock.calls.map(([url]) => url.query)).toEqual([
		{ period: 'ytd' },
		{ mapSize: 'volume' },
		{ cardSort: 'trailingPE' }
	])

	await open(sectorsPage, { period: 'ytd', mapSize: 'volume', cardSort: 'trailingPE' })
	expect(radio('Sector performance period', 'YTD').checked).toBe(true)
	expect(radio('Treemap size', 'Volume').checked).toBe(true)
	expect(container.textContent).toContain('Ranked by P/E')

	// Picking the default removes its key, so the plain route stays the default view.
	await act(async () => radio('Sector performance period', '1D').click())
	expect(pushedQuery()).toEqual({ mapSize: 'volume', cardSort: 'trailingPE' })
})

test('an unknown value in a sector page link opens the default', async () => {
	await open(sectorsPage, { period: '5y', mapSize: 'employees' })
	expect(radio('Sector performance period', '1D').checked).toBe(true)
	expect(radio('Treemap size', 'Market cap').checked).toBe(true)
})

test('the industry map By sector toggle round-trips through the URL', async () => {
	const bySector = () =>
		[...container.querySelectorAll('button')].find((button) => accessibleName(button) === 'By sector')!
	await open(industriesPage, {})
	expect(bySector().getAttribute('aria-pressed')).toBe('false')

	await act(async () => bySector().click())
	await open(industriesPage, pushedQuery())
	expect(bySector().getAttribute('aria-pressed')).toBe('true')

	await act(async () => bySector().click())
	expect(pushedQuery()).toEqual({})
})
