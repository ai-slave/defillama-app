import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Window } from 'happy-dom'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { AuthProvider } from '~/auth'
import type { RWAChartDataset } from '~/containers/RWA/chartDataset'
import type { IRWAPerpsMarket } from '../api.types'
import { RWAPerpsDashboard } from '../Dashboard'
import type {
	IRWAPerpsAssetGroupPageData,
	IRWAPerpsAssetPageData,
	IRWAPerpsOverviewPageData,
	IRWAPerpsVenuePageData
} from '../types'

const router = vi.hoisted(() => ({ query: {} as Record<string, string> }))
vi.mock('next/router', () => ({
	useRouter: () => ({ query: router.query, pathname: '/rwa/perps', asPath: '/rwa/perps', push() {} })
}))

beforeEach(() => {
	router.query = {}
})

type DashboardProps = Parameters<typeof RWAPerpsDashboard>[0]

/** Server-renders the dashboard as a page does; charts are lazy, so the markup holds everything around them. */
function render(
	props: DashboardProps,
	cachedChart?: { key: unknown; state: { data?: RWAChartDataset; error?: Error } }
) {
	const client = new QueryClient()
	if (cachedChart) {
		const query = client.getQueryCache().build(client, { queryKey: ['rwa-perps-chart', cachedChart.key] })
		query.setState(
			cachedChart.state.error
				? { status: 'error', error: cachedChart.state.error }
				: { status: 'success', data: cachedChart.state.data, dataUpdatedAt: Date.now() }
		)
	}
	const html = renderToStaticMarkup(
		<QueryClientProvider client={client}>
			<AuthProvider>
				<RWAPerpsDashboard {...props} />
			</AuthProvider>
		</QueryClientProvider>
	)
	client.clear()
	return html
}

/** Chart controls between the stat cards and the table, as text, with each control's accessible name. */
function chartToolbar(html: string) {
	return html
		.slice(html.indexOf('Est. Protocol Fees'), html.indexOf('<table'))
		.replace(/<[^>]*?aria-label="([^"]*)"[^>]*>/g, ' [$1] ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
}

/** The accessible names of the market filter toggles, in toolbar order. */
function filterToggles(html: string) {
	const { document } = new Window()
	document.body.innerHTML = html
	return Array.from(document.querySelectorAll('input[type="checkbox"]'), (input) => input.closest('label')?.textContent)
}

/** The contracts shown in the markets table, in row order. */
function tableContracts(html: string, contracts: Array<string>) {
	const body = html.slice(html.indexOf('<tbody'), html.indexOf('</tbody>'))
	return contracts
		.filter((contract) => body.includes(`>${contract}<`))
		.sort((a, b) => body.indexOf(`>${a}<`) - body.indexOf(`>${b}<`))
}

/** Header labels of the markets table, in column order. */
function tableHeaders(html: string) {
	const head = html.slice(html.indexOf('<thead'), html.indexOf('</thead>'))
	return [...head.matchAll(/<th[^>]*>(.*?)<\/th>/g)].map(([, cell]) => cell.replace(/<[^>]+>/g, '').trim())
}

const overviewMarket: IRWAPerpsMarket = {
	id: 'xyz:meta',
	timestamp: 1_775_011_512,
	contract: 'xyz:META',
	venue: 'xyz',
	venueType: 'DEX',
	openInterest: 100,
	openInterestChange24h: 25,
	volume24h: 50,
	volume24hChange24h: -10,
	price: 500,
	priceChange24h: 5,
	fundingRate: 0.00001,
	premium: 0.0002,
	cumulativeFunding: 10,
	referenceAsset: 'Meta',
	referenceAssetGroup: 'Equities',
	assetClass: ['Stock Perp'],
	parentPlatform: 'trade[XYZ]',
	pair: '',
	marginAsset: 'USDC',
	settlementAsset: 'USDC',
	category: ['RWA Perps'],
	issuer: 'XYZ',
	website: ['https://trade.xyz/'],
	link: null,
	oracleProvider: 'Pyth equity feed',
	description: 'Perpetual market',
	accessModel: 'Permissionless',
	rwaClassification: 'Programmable Finance',
	makerFeeRate: 0.0002,
	takerFeeRate: 0.0005,
	deployerFeeShare: 0.5,
	oraclePx: 501,
	midPx: 500.5,
	prevDayPx: 480,
	maxLeverage: 10,
	szDecimals: 2,
	fundingIntervalHours: 1,
	volume7d: 300,
	volume30d: 1000,
	volumeAllTime: 5000,
	estimatedProtocolFees24h: 1,
	estimatedProtocolFees7d: 3,
	estimatedProtocolFees30d: 10,
	estimatedProtocolFeesAllTime: 50,
	suspicious: false
}

const overviewData = {
	markets: [overviewMarket],
	initialChartDataset: { source: [], dimensions: ['timestamp'] },
	totals: {
		openInterest: 100,
		openInterestChange24h: 25,
		volume24h: 50,
		volume24hChange24h: -10,
		markets: 1,
		protocolFees24h: 1,
		cumulativeFunding: 10
	}
} satisfies IRWAPerpsOverviewPageData

const cexMarket: IRWAPerpsMarket = {
	...overviewMarket,
	id: 'binance:metausdt',
	contract: 'binance:METAUSDT',
	venue: 'binance',
	venueType: 'CEX',
	openInterest: 400
}

const cexOverviewData = {
	...overviewData,
	markets: [cexMarket, overviewMarket]
} satisfies IRWAPerpsOverviewPageData

const multiBaseAssetOverviewData = {
	...overviewData,
	markets: [
		overviewMarket,
		{
			...overviewMarket,
			id: 'xyz:nvda',
			contract: 'xyz:NVDA',
			referenceAsset: 'NVIDIA',
			openInterest: 80,
			openInterestChange24h: 25,
			volume24h: 40,
			volume24hChange24h: -10,
			estimatedProtocolFees24h: 2
		},
		{
			...overviewMarket,
			id: 'flx:gold',
			contract: 'flx:GOLD',
			venue: 'flx',
			referenceAsset: 'Gold',
			referenceAssetGroup: 'Commodities',
			assetClass: ['Commodity Perp'],
			openInterest: 50,
			openInterestChange24h: 25,
			volume24h: 20,
			volume24hChange24h: -10,
			estimatedProtocolFees24h: 3
		}
	],
	totals: {
		...overviewData.totals,
		openInterest: 230,
		volume24h: 110,
		markets: 3,
		protocolFees24h: 6
	}
} satisfies IRWAPerpsOverviewPageData

const venueData = {
	venue: 'xyz',
	markets: overviewData.markets,
	initialChartDataset: overviewData.initialChartDataset,
	venueLinks: [{ label: 'All', to: '/rwa/perps/venues' }],
	totals: {
		openInterest: 100,
		openInterestChange24h: 25,
		volume24h: 50,
		volume24hChange24h: -10,
		markets: 1,
		protocolFees24h: 1
	}
} satisfies IRWAPerpsVenuePageData

const assetGroupData = {
	assetGroup: 'Equities',
	markets: overviewData.markets,
	initialChartDataset: overviewData.initialChartDataset,
	assetGroupLinks: [{ label: 'All', to: '/rwa/perps/asset-groups' }],
	totals: {
		openInterest: 100,
		openInterestChange24h: 25,
		volume24h: 50,
		volume24hChange24h: -10,
		markets: 1,
		protocolFees24h: 1
	}
} satisfies IRWAPerpsAssetGroupPageData

const assetData = {
	asset: 'Meta',
	markets: overviewData.markets,
	initialChartDataset: overviewData.initialChartDataset,
	assetLinks: [{ label: 'All', to: '/rwa/perps/assets' }],
	totals: {
		openInterest: 100,
		openInterestChange24h: 25,
		volume24h: 50,
		volume24hChange24h: -10,
		markets: 1,
		protocolFees24h: 1
	}
} satisfies IRWAPerpsAssetPageData

const forexData = {
	...overviewData,
	markets: [
		{ ...overviewMarket, id: 'fx:eurusd', contract: 'EURUSD', referenceAsset: 'EUR/USD', assetClass: ['Forex Perps'] },
		{ ...overviewMarket, id: 'fx:gbpusd', contract: 'GBPUSD', referenceAsset: 'GBP/USD', assetClass: ['Forex Perps'] }
	]
} satisfies IRWAPerpsOverviewPageData

const ALL_CONTRACTS = ['binance:METAUSDT', 'xyz:META', 'xyz:NVDA', 'flx:GOLD', 'EURUSD', 'GBPUSD']

describe('RWA perps dashboard chart controls', () => {
	test('offers the CEX and Forex filters on the overview and only the CEX filter on the Forex page', () => {
		expect(filterToggles(render({ mode: 'overview', data: multiBaseAssetOverviewData }))).toEqual([
			'Forex Perps',
			'CEX Venues'
		])
		expect(filterToggles(render({ mode: 'overview', data: cexOverviewData, assetClassFilter: 'Forex Perps' }))).toEqual(
			['CEX Venues']
		)
	})

	test('defaults the Forex page time series to base asset when configured', () => {
		const toolbar = chartToolbar(
			render({
				mode: 'overview',
				data: overviewData,
				assetClassFilter: 'Forex Perps',
				defaultTimeSeriesBreakdown: 'baseAsset'
			})
		)
		expect(toolbar).toContain('Base Asset dropdown')
	})
})

describe('RWA perps dashboard history', () => {
	const DEFAULT_REQUEST = {
		source: 'overview-breakdown',
		key: 'openInterest',
		breakdown: 'assetGroup',
		target: { kind: 'excludeAssetClass', slug: 'Forex Perps' },
		includeCex: false
	}
	const NOT_ENOUGH_HISTORY = 'There is not enough time-series history for this selection yet.'
	const history = (days: number) => ({
		source: Array.from({ length: days }, (_, index) => ({
			timestamp: 1_774_483_200_000 + index * 86_400_000,
			Equities: 100
		})),
		dimensions: ['timestamp', 'Equities']
	})

	test.each([
		{ days: 1, explained: true },
		{ days: 2, explained: false }
	])('explains a fetched history of $days day(s) only when it is too short to chart', ({ days, explained }) => {
		const html = render(
			{ mode: 'overview', data: overviewData },
			{ key: DEFAULT_REQUEST, state: { data: history(days) } }
		)

		expect(chartToolbar(html)).toContain('Time Series Chart dropdown')
		expect(html.includes(NOT_ENOUGH_HISTORY)).toBe(explained)
	})

	test('explains the missing history instead of loading when the filters leave no markets', () => {
		router.query = { excludeBaseAssets: 'Meta' }
		const html = render({ mode: 'overview', data: overviewData })

		expect(tableContracts(html, ALL_CONTRACTS)).toEqual([])
		expect(html).toContain(NOT_ENOUGH_HISTORY)
		expect(html).not.toContain('Loading')
	})

	test('shows the preloaded history without surfacing a stale cached chart error', () => {
		const html = render(
			{ mode: 'overview', data: { ...overviewData, initialChartDataset: history(2) } },
			{ key: DEFAULT_REQUEST, state: { error: new Error('stale cached error') } }
		)

		expect(chartToolbar(html)).toContain('Time Series Chart dropdown')
		expect(html).not.toContain('stale cached error')
		expect(html).not.toContain(NOT_ENOUGH_HISTORY)
	})
})

describe('RWA perps dashboard markets table', () => {
	test.each([
		{ name: 'hides CEX venues by default', data: cexOverviewData, query: {}, rows: ['xyz:META'] },
		{
			name: 'lists CEX venues once opted in',
			data: cexOverviewData,
			query: { includeCex: 'true' },
			rows: ['binance:METAUSDT', 'xyz:META']
		},
		{
			name: 'keeps only included base assets',
			data: multiBaseAssetOverviewData,
			query: { baseAssets: 'Meta' },
			rows: ['xyz:META']
		},
		{
			name: 'drops excluded base assets',
			data: multiBaseAssetOverviewData,
			query: { excludeBaseAssets: 'Gold' },
			rows: ['xyz:META', 'xyz:NVDA']
		}
	])('$name', ({ data, query, rows }) => {
		router.query = query
		expect(tableContracts(render({ mode: 'overview', data }), ALL_CONTRACTS)).toEqual(rows)
	})

	test('filters Forex rows by base asset and ignores the hidden asset-class filter on the Forex page', () => {
		const forexPage = {
			mode: 'overview',
			data: forexData,
			assetClassFilter: 'Forex Perps',
			defaultTimeSeriesBreakdown: 'baseAsset'
		} as const
		router.query = { baseAssets: 'EUR/USD' }
		expect(tableContracts(render(forexPage), ALL_CONTRACTS)).toEqual(['EURUSD'])

		router.query = { assetClasses: 'Stock Perp' }
		expect(tableContracts(render(forexPage), ALL_CONTRACTS)).toEqual(['EURUSD', 'GBPUSD'])
	})

	test('includes CEX markets by default on CEX-only venue and asset pages but not asset-group pages', () => {
		expect(
			tableContracts(
				render({ mode: 'venue', data: { ...venueData, venue: 'binance', markets: [cexMarket] } }),
				ALL_CONTRACTS
			)
		).toEqual(['binance:METAUSDT'])
		expect(
			tableContracts(render({ mode: 'asset', data: { ...assetData, markets: [cexMarket] } }), ALL_CONTRACTS)
		).toEqual(['binance:METAUSDT'])
		expect(
			tableContracts(render({ mode: 'assetGroup', data: { ...assetGroupData, markets: [cexMarket] } }), ALL_CONTRACTS)
		).toEqual([])
	})

	test.each([
		{
			mode: 'overview',
			data: overviewData,
			leading: ['Contract', 'Venue', 'Asset Class', 'Asset Group', 'Base Asset']
		},
		{ mode: 'venue', data: venueData, leading: ['Contract', 'Base Asset', 'Asset Group', 'Asset Class'] },
		{ mode: 'assetGroup', data: assetGroupData, leading: ['Contract', 'Venue', 'Base Asset', 'Asset Class'] }
	] as const)('orders the $mode table columns and shows 24h changes on the stat cards', (props) => {
		const html = render(props as DashboardProps)
		const cards = html.slice(0, html.indexOf('<table'))
		expect(cards).toContain('+25.00%')
		expect(cards).toContain('-10.00%')

		const headers = tableHeaders(html)

		expect(headers.slice(0, props.leading.length)).toEqual(props.leading)
		expect(headers).toEqual(expect.arrayContaining(['24h OI Change', '24h Volume Change', '24h Price Change']))
	})

	test('keeps suspicious markets out of cross-venue headlines while listing and explaining them', () => {
		const ordinaryMarket = {
			...overviewMarket,
			openInterest: 1_000_000,
			volume24h: 500_000,
			estimatedProtocolFees24h: 1000
		}
		const suspiciousMarket = {
			...overviewMarket,
			id: 'parcl:nyc',
			contract: 'parcl:NYC',
			venue: 'Parcl',
			openInterest: 9_000_000,
			volume24h: 4_500_000,
			estimatedProtocolFees24h: 9000,
			suspicious: true
		}
		const html = render({
			mode: 'overview',
			data: {
				...overviewData,
				markets: [ordinaryMarket, suspiciousMarket],
				totals: {
					...overviewData.totals,
					openInterest: 10_000_000,
					volume24h: 5_000_000,
					markets: 2,
					protocolFees24h: 10_000
				}
			}
		})

		expect(html).toContain('$1m')
		expect(html).not.toContain('$10m')
		expect(tableContracts(html, ['parcl:NYC', 'xyz:META'])).toEqual(['parcl:NYC', 'xyz:META'])
		expect(html).toContain('marked as suspicious and is excluded from cross-venue totals and charts')
	})
})
