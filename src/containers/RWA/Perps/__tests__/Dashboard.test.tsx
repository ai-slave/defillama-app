import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHART_COLORS } from '~/constants/colors'
import type { RWAChartDataset } from '~/containers/RWA/chartDataset'
import type { IRWAPerpsMarket } from '../api.types'
import { RWAPerpsDashboard } from '../Dashboard'
import {
	buildRWAPerpsTimeSeriesCharts,
	buildRWAPerpsTimeSeriesDatasetForRows,
	getRWAPerpsIncludedRows
} from '../dashboardData'
import type {
	IRWAPerpsAssetGroupPageData,
	IRWAPerpsAssetPageData,
	IRWAPerpsOverviewPageData,
	IRWAPerpsVenuePageData
} from '../types'

let routerQuery: Record<string, string | string[]> = {}
type CapturedQueryOptions = {
	queryKey: unknown[]
	queryFn: () => Promise<unknown>
	enabled: boolean
}

type CapturedColumn = {
	id?: string
	header?: string
	cell?: (info: { row: { original: IRWAPerpsMarket }; getValue: () => string }) => ReactNode
}

type CapturedTableProps = {
	data: IRWAPerpsMarket[]
	columns: CapturedColumn[]
}

let lastTableWithSearchProps: CapturedTableProps | null = null
let lastUseQueryOptions: CapturedQueryOptions | null = null

function getLastTableWithSearchProps(): CapturedTableProps {
	if (!lastTableWithSearchProps) throw new Error('Expected the table props to be captured')
	return lastTableWithSearchProps
}

function getLastUseQueryOptions(): CapturedQueryOptions {
	if (!lastUseQueryOptions) throw new Error('Expected the query options to be captured')
	return lastUseQueryOptions
}

vi.mock('next/router', () => ({
	useRouter: () => ({
		query: routerQuery,
		pathname: '/rwa/perps'
	})
}))

let queryState: {
	data: RWAChartDataset | null
	isLoading: boolean
	error: Error | null
} = {
	data: null,
	isLoading: false,
	error: null
}

vi.mock('@tanstack/react-query', () => ({
	skipToken: Symbol('skipToken'),
	useQuery: (options: CapturedQueryOptions) => {
		lastUseQueryOptions = options
		return queryState
	}
}))

const { fetchJson } = vi.hoisted(() => ({
	fetchJson: vi.fn()
}))

vi.mock('~/utils/async', () => ({
	fetchJson
}))

vi.mock('~/components/Select/Select', () => ({
	Select: ({ label }: { label: string }) => <div>{label}</div>
}))

vi.mock('~/components/Select/SelectWithCombobox', () => ({
	SelectWithCombobox: ({ label, selectedValues }: { label: string; selectedValues: string[] }) => (
		<div>{`combobox:${label}:${selectedValues.join('|')}`}</div>
	)
}))

vi.mock('~/components/ChartExport/ChartExportButtons', () => ({
	ChartExportButtons: () => <div>exports</div>
}))

vi.mock('~/ui/QuestionHelper', () => ({
	QuestionHelper: ({ text }: { text: string }) => <span>{text}</span>
}))

vi.mock('~/components/Table/TableWithSearch', () => ({
	TableWithSearch: (props: CapturedTableProps) => {
		lastTableWithSearchProps = props
		return <div>table</div>
	}
}))

vi.mock('~/components/RowLinksWithDropdown', () => ({
	RowLinksWithDropdown: () => <div>links</div>
}))

vi.mock('~/hooks/useGetChartInstance', () => ({
	useGetChartInstance: () => ({
		chartInstance: () => null,
		handleChartReady: () => {}
	})
}))

vi.mock('~/components/ECharts/PieChart', () => ({
	default: () => <div>pie</div>
}))

vi.mock('~/components/ECharts/HBarChart', () => ({
	default: () => <div>hbar</div>
}))

vi.mock('~/components/ECharts/TreemapChart', () => ({
	default: () => <div>treemap</div>
}))

vi.mock('~/components/ECharts/MultiSeriesChart', () => ({
	default: () => <div>timeseries</div>
}))

const overviewMarket: IRWAPerpsMarket = {
	id: 'xyz:meta',
	timestamp: 1775011512,
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

describe('getRWAPerpsIncludedRows', () => {
	const suspiciousMarket: IRWAPerpsMarket = {
		...overviewMarket,
		id: 'parcl:nyc',
		venue: 'Parcl',
		suspicious: true
	}
	const markets = [overviewMarket, suspiciousMarket]

	it('excludes suspicious markets from cross-venue charts', () => {
		expect(getRWAPerpsIncludedRows(markets, 'overview')).toEqual([overviewMarket])
		expect(getRWAPerpsIncludedRows(markets, 'assetGroup')).toEqual([overviewMarket])
	})

	it('keeps suspicious markets in venue totals and charts', () => {
		expect(getRWAPerpsIncludedRows(markets, 'venue')).toBe(markets)
	})

	it('reuses an unchanged cross-venue population when no suspicious market exists', () => {
		const ordinaryMarkets = [overviewMarket]
		expect(getRWAPerpsIncludedRows(ordinaryMarkets, 'overview')).toBe(ordinaryMarkets)
	})
})

describe('RWAPerpsDashboard treemap controls', () => {
	beforeEach(() => {
		routerQuery = {}
		lastTableWithSearchProps = null
		lastUseQueryOptions = null
		fetchJson.mockReset()
		fetchJson.mockResolvedValue({ source: [], dimensions: ['timestamp'] })
		queryState = {
			data: null,
			isLoading: false,
			error: null
		}
	})

	it('shows treemap parent and nested-grouping controls plus reset in treemap view', () => {
		routerQuery = { chartView: 'treemap' }
		const html = renderToStaticMarkup(<RWAPerpsDashboard mode="overview" data={overviewData} />)

		expect(html).toContain('Asset Group')
		expect(html).toContain('Nested by: Base Asset')
		expect(html).toContain('reset')
	})

	it('shows the asset-group time-series breakdown by default on the overview page', () => {
		const html = renderToStaticMarkup(<RWAPerpsDashboard mode="overview" data={overviewData} />)

		expect(html).toContain('Time Series Chart')
		expect(html).toContain('Asset Group')
		expect(html).not.toContain('Nested by:')
		expect(html).not.toContain('reset')
	})

	it('requests no-Forex overview time-series data by default', async () => {
		renderToStaticMarkup(<RWAPerpsDashboard mode="overview" data={overviewData} />)

		await getLastUseQueryOptions().queryFn()

		expect(fetchJson).toHaveBeenCalledWith(
			'/api/public/rwa/perps/overview-breakdown?breakdown=assetGroup&key=openInterest&excludeAssetClass=Forex+Perps'
		)
	})

	it('shows the CEX filter on the overview', () => {
		const html = renderToStaticMarkup(<RWAPerpsDashboard mode="overview" data={overviewData} />)

		expect(html).toContain('CEX Venues')
	})

	it('hides CEX venues from the table by default', () => {
		renderToStaticMarkup(<RWAPerpsDashboard mode="overview" data={cexOverviewData} />)

		expect(getLastTableWithSearchProps().data.map((row) => row.contract)).toEqual(['xyz:META'])
	})

	it('drops the DEX scope from both table and chart once CEX is opted in', async () => {
		renderToStaticMarkup(<RWAPerpsDashboard mode="overview" data={cexOverviewData} />)
		const dexQueryKey = getLastUseQueryOptions().queryKey

		routerQuery = { includeCex: 'true' }
		renderToStaticMarkup(<RWAPerpsDashboard mode="overview" data={cexOverviewData} />)

		expect(getLastTableWithSearchProps().data.map((row) => row.contract)).toEqual(['binance:METAUSDT', 'xyz:META'])
		expect(getLastUseQueryOptions().queryKey).not.toEqual(dexQueryKey)

		await getLastUseQueryOptions().queryFn()
		expect(fetchJson).toHaveBeenCalledWith(
			'/api/public/rwa/perps/overview-breakdown?breakdown=assetGroup&key=openInterest&includeCex=true&excludeAssetClass=Forex+Perps'
		)
	})

	it('requests all-market overview time-series data when Forex is included', async () => {
		routerQuery = { includeForex: 'true' }
		renderToStaticMarkup(<RWAPerpsDashboard mode="overview" data={overviewData} />)

		await getLastUseQueryOptions().queryFn()

		expect(fetchJson).toHaveBeenCalledWith(
			'/api/public/rwa/perps/overview-breakdown?breakdown=assetGroup&key=openInterest'
		)
	})

	it('fetches all-market default time-series data when the include-Forex toggle overrides the preloaded no-Forex dataset', () => {
		routerQuery = { includeForex: 'true' }
		renderToStaticMarkup(
			<RWAPerpsDashboard
				mode="overview"
				data={{
					...overviewData,
					initialChartDataset: {
						source: [
							{ timestamp: 1774483200000, Equities: 100 },
							{ timestamp: 1774569600000, Equities: 120 }
						],
						dimensions: ['timestamp', 'Equities']
					}
				}}
			/>
		)

		expect(getLastUseQueryOptions().enabled).toBe(true)
	})

	it('shows the CEX filter and requests the default DEX Forex aggregate', async () => {
		const html = renderToStaticMarkup(
			<RWAPerpsDashboard mode="overview" data={cexOverviewData} assetClassFilter="Forex Perps" />
		)

		expect(html).toContain('CEX Venues')

		await getLastUseQueryOptions().queryFn()

		expect(fetchJson).toHaveBeenCalledWith(
			'/api/public/rwa/perps/overview-breakdown?breakdown=assetGroup&key=openInterest&assetClass=Forex+Perps'
		)
	})

	it('defaults the Forex overview time series to base asset when configured', async () => {
		const html = renderToStaticMarkup(
			<RWAPerpsDashboard
				mode="overview"
				data={overviewData}
				assetClassFilter="Forex Perps"
				defaultTimeSeriesBreakdown="baseAsset"
			/>
		)

		expect(html).toContain('Base Asset')

		await getLastUseQueryOptions().queryFn()

		expect(fetchJson).toHaveBeenCalledWith(
			'/api/public/rwa/perps/overview-breakdown?breakdown=baseAsset&key=openInterest&assetClass=Forex+Perps'
		)
	})

	it('uses the full Forex chart when CEX venues are included', async () => {
		routerQuery = { includeCex: 'true' }
		renderToStaticMarkup(
			<RWAPerpsDashboard
				mode="overview"
				data={overviewData}
				assetClassFilter="Forex Perps"
				defaultTimeSeriesBreakdown="baseAsset"
			/>
		)

		await getLastUseQueryOptions().queryFn()

		expect(fetchJson).toHaveBeenCalledWith(
			'/api/public/rwa/perps/overview-breakdown?breakdown=baseAsset&key=openInterest&includeCex=true&assetClass=Forex+Perps'
		)
	})

	it('projects filtered Forex rows from the DEX market series', async () => {
		routerQuery = { baseAssets: 'EUR/USD' }
		const forexData = {
			...overviewData,
			markets: [
				{
					...overviewMarket,
					id: 'fx:eurusd',
					contract: 'EURUSD',
					referenceAsset: 'EUR/USD',
					assetClass: ['Forex Perps']
				},
				{
					...overviewMarket,
					id: 'fx:gbpusd',
					contract: 'GBPUSD',
					referenceAsset: 'GBP/USD',
					assetClass: ['Forex Perps']
				}
			]
		} satisfies IRWAPerpsOverviewPageData

		renderToStaticMarkup(
			<RWAPerpsDashboard
				mode="overview"
				data={forexData}
				assetClassFilter="Forex Perps"
				defaultTimeSeriesBreakdown="baseAsset"
			/>
		)

		expect(getLastTableWithSearchProps().data.map((row) => row.contract)).toEqual(['EURUSD'])

		await getLastUseQueryOptions().queryFn()

		expect(fetchJson).toHaveBeenCalledWith(
			'/api/public/rwa/perps/market-breakdown?key=openInterest&assetClass=Forex+Perps'
		)
	})

	it('ignores hidden Asset Class query params on the Forex page', () => {
		routerQuery = { assetClasses: 'Stock Perp' }
		const forexData = {
			...overviewData,
			markets: [
				{
					...overviewMarket,
					id: 'fx:eurusd',
					contract: 'EURUSD',
					referenceAsset: 'EUR/USD',
					assetClass: ['Forex Perps']
				},
				{
					...overviewMarket,
					id: 'fx:gbpusd',
					contract: 'GBPUSD',
					referenceAsset: 'GBP/USD',
					assetClass: ['Forex Perps']
				}
			]
		} satisfies IRWAPerpsOverviewPageData

		renderToStaticMarkup(
			<RWAPerpsDashboard
				mode="overview"
				data={forexData}
				assetClassFilter="Forex Perps"
				defaultTimeSeriesBreakdown="baseAsset"
			/>
		)

		expect(getLastTableWithSearchProps().data.map((row) => row.contract)).toEqual(['EURUSD', 'GBPUSD'])
	})

	it('shows a filters dialog next to the separate Forex filter when multiple filters are available', () => {
		const html = renderToStaticMarkup(<RWAPerpsDashboard mode="overview" data={multiBaseAssetOverviewData} />)

		expect(html).toContain('Filters')
		expect(html).toContain('Forex Perps')
		expect(html).toContain('Reset filters')
		expect(html).not.toContain('combobox:Base Asset:Meta|NVIDIA|Gold')
	})

	it('filters rows and requests market time-series data when Base Asset include selection is active', async () => {
		routerQuery = { baseAssets: 'Meta' }
		renderToStaticMarkup(<RWAPerpsDashboard mode="overview" data={multiBaseAssetOverviewData} />)

		expect(getLastTableWithSearchProps().data.map((row) => row.contract)).toEqual(['xyz:META'])

		await getLastUseQueryOptions().queryFn()

		expect(fetchJson).toHaveBeenCalledWith(
			'/api/public/rwa/perps/market-breakdown?key=openInterest&excludeAssetClass=Forex+Perps'
		)
	})

	it('filters rows using Base Asset exclude query semantics', () => {
		routerQuery = { excludeBaseAssets: 'Gold' }
		renderToStaticMarkup(<RWAPerpsDashboard mode="overview" data={multiBaseAssetOverviewData} />)

		expect(getLastTableWithSearchProps().data.map((row) => row.contract)).toEqual(['xyz:META', 'xyz:NVDA'])
	})

	it('regroups fetched contract time-series data by the selected breakdown for Base Asset filters', () => {
		const dataset = buildRWAPerpsTimeSeriesDatasetForRows({
			dataset: {
				source: [
					{ timestamp: 1774396800000, 'flx:GOLD': 4 },
					{
						timestamp: 1774483200000,
						'xyz:META': 10,
						'xyz:NVDA': 20,
						'flx:GOLD': 5
					},
					{ timestamp: 1774526400000, 'flx:GOLD': 5.5 },
					{
						timestamp: 1774569600000,
						'xyz:META': 12,
						'xyz:NVDA': 22,
						'flx:GOLD': 6
					}
				],
				dimensions: ['timestamp', 'xyz:META', 'xyz:NVDA', 'flx:GOLD']
			},
			rows: multiBaseAssetOverviewData.markets.slice(0, 2),
			breakdown: 'assetGroup'
		})

		expect(dataset).toEqual({
			source: [
				{ timestamp: 1774483200000, Equities: 30 },
				{ timestamp: 1774569600000, Equities: 34 }
			],
			dimensions: ['timestamp', 'Equities']
		})
	})

	it('regroups fetched market-id time-series data by selected market ids', () => {
		const dataset = buildRWAPerpsTimeSeriesDatasetForRows({
			dataset: {
				source: [
					{
						timestamp: 1774483200000,
						'alpha:aapl': 10,
						'beta:aapl': 20,
						'fx:eurusd': 5
					},
					{
						timestamp: 1774569600000,
						'alpha:aapl': 12,
						'beta:aapl': 22,
						'fx:eurusd': 6
					}
				],
				dimensions: ['timestamp', 'alpha:aapl', 'beta:aapl', 'fx:eurusd']
			},
			rows: [
				{
					...overviewMarket,
					id: 'alpha:aapl',
					contract: 'AAPL',
					venue: 'Alpha',
					referenceAssetGroup: 'Equities'
				},
				{
					...overviewMarket,
					id: 'beta:aapl',
					contract: 'AAPL',
					venue: 'Beta',
					referenceAssetGroup: 'Equities'
				}
			],
			breakdown: 'venue',
			seriesKey: 'id'
		})

		expect(dataset).toEqual({
			source: [
				{ timestamp: 1774483200000, Alpha: 10, Beta: 20 },
				{ timestamp: 1774569600000, Alpha: 12, Beta: 22 }
			],
			dimensions: ['timestamp', 'Beta', 'Alpha']
		})
	})

	it('requests the DEX contract aggregate on the Forex page', async () => {
		routerQuery = {
			chartView: 'timeSeries',
			timeSeriesChartBreakdown: 'contract'
		}
		renderToStaticMarkup(<RWAPerpsDashboard mode="overview" data={overviewData} assetClassFilter="Forex Perps" />)

		await getLastUseQueryOptions().queryFn()

		expect(fetchJson).toHaveBeenCalledWith(
			'/api/public/rwa/perps/contract-breakdown?key=openInterest&assetClass=Forex+Perps'
		)
	})

	it('requests the DEX aggregate on Asset Group pages', async () => {
		renderToStaticMarkup(<RWAPerpsDashboard mode="assetGroup" data={assetGroupData} />)

		await getLastUseQueryOptions().queryFn()

		expect(fetchJson).toHaveBeenCalledWith(
			'/api/public/rwa/perps/overview-breakdown?breakdown=baseAsset&key=openInterest&assetGroup=Equities'
		)
	})

	it('hides the treemap nested-grouping selector when parent grouping is Contract', () => {
		routerQuery = {
			chartView: 'treemap',
			nonTimeSeriesChartBreakdown: 'contract'
		}
		const html = renderToStaticMarkup(<RWAPerpsDashboard mode="overview" data={overviewData} />)

		expect(html).toContain('Contract')
		expect(html).not.toContain('Nested by:')
		expect(html).toContain('reset')
	})

	it('shows the treemap nested-grouping selector when parent grouping is Base Asset', () => {
		routerQuery = {
			chartView: 'treemap',
			nonTimeSeriesChartBreakdown: 'baseAsset'
		}
		const html = renderToStaticMarkup(<RWAPerpsDashboard mode="overview" data={overviewData} />)

		expect(html).toContain('Base Asset')
		expect(html).toContain('Nested by: Contract')
		expect(html).toContain('reset')
	})

	it('shows asset-group treemap controls with a base-asset nested default', () => {
		routerQuery = {
			chartView: 'treemap',
			nonTimeSeriesChartBreakdown: 'assetGroup'
		}
		const html = renderToStaticMarkup(<RWAPerpsDashboard mode="overview" data={overviewData} />)

		expect(html).toContain('Asset Group')
		expect(html).toContain('Nested by: Base Asset')
		expect(html).toContain('reset')
	})

	it('keeps the no-grouping treemap state selectable for Base Asset breakdowns', () => {
		routerQuery = {
			chartView: 'treemap',
			nonTimeSeriesChartBreakdown: 'baseAsset',
			treemapNestedBy: 'none'
		}
		const html = renderToStaticMarkup(<RWAPerpsDashboard mode="overview" data={overviewData} />)

		expect(html).toContain('Base Asset')
		expect(html).toContain('Nested by: No Grouping')
		expect(html).toContain('reset')
	})

	it('shows parent grouping but hides treemap-only controls outside treemap view', () => {
		routerQuery = { chartView: 'pie' }
		const html = renderToStaticMarkup(<RWAPerpsDashboard mode="overview" data={overviewData} />)

		expect(html).toContain('Asset Group')
		expect(html).not.toContain('Nested by:')
		expect(html).not.toContain('reset')
	})

	it('keeps the requested overview table column order', () => {
		renderToStaticMarkup(<RWAPerpsDashboard mode="overview" data={overviewData} />)

		expect(
			getLastTableWithSearchProps()
				.columns.slice(0, 5)
				.map((column) => column.header)
		).toEqual(['Contract', 'Venue', 'Asset Class', 'Asset Group', 'Base Asset'])
	})

	it('keeps the requested venue table column order', () => {
		renderToStaticMarkup(<RWAPerpsDashboard mode="venue" data={venueData} />)

		expect(
			getLastTableWithSearchProps()
				.columns.slice(0, 4)
				.map((column) => column.header)
		).toEqual(['Contract', 'Base Asset', 'Asset Group', 'Asset Class'])
	})

	it('shows asset-group detail tables with the venue column restored', () => {
		renderToStaticMarkup(<RWAPerpsDashboard mode="assetGroup" data={assetGroupData} />)

		expect(
			getLastTableWithSearchProps()
				.columns.slice(0, 4)
				.map((column) => column.header)
		).toEqual(['Contract', 'Venue', 'Base Asset', 'Asset Class'])
	})

	it('excludes suspicious markets from cross-venue headlines while retaining and explaining their table rows', () => {
		const ordinaryMarket = {
			...overviewMarket,
			openInterest: 1_000_000,
			volume24h: 500_000,
			estimatedProtocolFees24h: 1_000
		}
		const suspiciousMarket = {
			...overviewMarket,
			id: 'parcl:nyc',
			contract: 'parcl:NYC',
			venue: 'Parcl',
			openInterest: 9_000_000,
			volume24h: 4_500_000,
			estimatedProtocolFees24h: 9_000,
			suspicious: true
		}
		const data = {
			...overviewData,
			markets: [ordinaryMarket, suspiciousMarket],
			totals: {
				...overviewData.totals,
				openInterest: 10_000_000,
				volume24h: 5_000_000,
				markets: 2,
				protocolFees24h: 10_000
			}
		} satisfies IRWAPerpsOverviewPageData

		const html = renderToStaticMarkup(<RWAPerpsDashboard mode="overview" data={data} />)

		expect(html).toContain('$1m')
		expect(html).not.toContain('$10m')
		expect(getLastTableWithSearchProps().data).toEqual([ordinaryMarket, suspiciousMarket])

		const contractColumn = getLastTableWithSearchProps().columns.find((column) => column.id === 'contract')
		if (!contractColumn?.cell) throw new Error('Expected the contract cell renderer')
		const cellHtml = renderToStaticMarkup(
			<>
				{contractColumn.cell({
					row: { original: suspiciousMarket },
					getValue: () => suspiciousMarket.contract
				})}
			</>
		)
		expect(cellHtml).toContain('marked as suspicious and is excluded from cross-venue totals and charts')
	})

	it('omits the access model column from the shared tables', () => {
		renderToStaticMarkup(<RWAPerpsDashboard mode="overview" data={overviewData} />)

		expect(getLastTableWithSearchProps().columns.map((column) => column.id)).not.toContain('accessModel')
	})

	it('shows 24h open interest and volume change columns in the shared tables', () => {
		renderToStaticMarkup(<RWAPerpsDashboard mode="overview" data={overviewData} />)

		expect(getLastTableWithSearchProps().columns.map((column) => column.id)).toEqual(
			expect.arrayContaining(['openInterestChange24h', 'volume24hChange24h', 'priceChange24h'])
		)
	})

	it('shows an explicit empty state when time-series data only has a single timestamp', () => {
		routerQuery = {
			chartView: 'timeSeries',
			timeSeriesChartBreakdown: 'assetClass'
		}
		queryState = {
			data: {
				source: [{ timestamp: 1774483200000, 'Stock Perp': 100 }],
				dimensions: ['timestamp', 'Stock Perp']
			},
			isLoading: false,
			error: null
		}

		const html = renderToStaticMarkup(<RWAPerpsDashboard mode="overview" data={overviewData} />)

		expect(html).toContain('There is not enough time-series history for this selection yet.')
		expect(html).not.toContain('timeseries')
	})

	it('ignores a cached query error while rendering a reusable server-preloaded dataset', () => {
		routerQuery = { chartView: 'timeSeries' }
		queryState = {
			data: null,
			isLoading: false,
			error: new Error('stale cached error')
		}
		const data = {
			...overviewData,
			initialChartDataset: {
				source: [
					{ timestamp: 1774483200000, Equities: 100 },
					{ timestamp: 1774569600000, Equities: 120 }
				],
				dimensions: ['timestamp', 'Equities']
			}
		} satisfies IRWAPerpsOverviewPageData

		const html = renderToStaticMarkup(<RWAPerpsDashboard mode="overview" data={data} />)

		expect(getLastUseQueryOptions().enabled).toBe(false)
		expect(html).not.toContain('stale cached error')
		expect(html).not.toContain('There is not enough time-series history for this selection yet.')
	})

	it('renders fetched default time-series data when no server-preloaded dataset is available', () => {
		routerQuery = { chartView: 'timeSeries' }
		queryState = {
			data: {
				source: [
					{ timestamp: 1774483200000, Meta: 100 },
					{ timestamp: 1774569600000, Meta: 120 }
				],
				dimensions: ['timestamp', 'Meta']
			},
			isLoading: false,
			error: null
		}

		const html = renderToStaticMarkup(<RWAPerpsDashboard mode="overview" data={overviewData} />)

		expect(html).not.toContain('Only a single snapshot is available')
	})

	it('renders the time-series metric switch labels from metric option names', () => {
		routerQuery = { chartView: 'timeSeries' }
		const html = renderToStaticMarkup(<RWAPerpsDashboard mode="overview" data={overviewData} />)

		expect(html).toContain('Open Interest')
		expect(html).toContain('Volume')
		expect(html).toContain('Markets')
		expect(html).toContain('Asset Group')
		expect(html).toContain('Total')
		expect(html).not.toContain('aria-label="Weekly"')
	})

	it('renders date grouping controls for volume time-series charts', () => {
		routerQuery = { chartView: 'timeSeries', chartType: 'volume24h' }
		const html = renderToStaticMarkup(<RWAPerpsDashboard mode="overview" data={overviewData} />)

		expect(html).toContain('aria-label="Daily"')
		expect(html).toContain('aria-label="Weekly"')
		expect(html).toContain('aria-label="Monthly"')
		expect(html).toContain('aria-label="Quarterly"')
		expect(html).toContain('aria-label="Yearly"')
		expect(html).not.toContain('aria-label="Cumulative"')
	})

	it('renders the selected time-series breakdown label when selected', () => {
		routerQuery = {
			chartView: 'timeSeries',
			timeSeriesChartBreakdown: 'baseAsset',
			timeSeriesMode: 'breakdown'
		}

		const html = renderToStaticMarkup(<RWAPerpsDashboard mode="overview" data={overviewData} />)

		expect(html).toContain('Base Asset')
	})

	it('builds bar-series configs for time-series volume', () => {
		expect(
			buildRWAPerpsTimeSeriesCharts({
				metric: 'volume24h',
				dimensions: ['timestamp', 'Meta', 'NVIDIA'],
				timeSeriesMode: 'breakdown'
			})
		).toMatchObject([
			{
				name: 'Meta',
				type: 'bar',
				stack: 'A',
				large: false,
				encode: { x: 'timestamp', y: 'Meta' },
				color: expect.any(String)
			},
			{
				name: 'NVIDIA',
				type: 'bar',
				stack: 'A',
				large: false,
				encode: { x: 'timestamp', y: 'NVIDIA' },
				color: expect.any(String)
			}
		])
	})

	it('does not enable point markers on overview line-series configs', () => {
		expect(
			buildRWAPerpsTimeSeriesCharts({
				metric: 'openInterest',
				dimensions: ['timestamp', 'Meta'],
				timeSeriesMode: 'breakdown'
			})
		).toMatchObject([
			{
				name: 'Meta',
				type: 'line',
				encode: { x: 'timestamp', y: 'Meta' },
				color: expect.any(String)
			}
		])
		expect(
			buildRWAPerpsTimeSeriesCharts({
				metric: 'openInterest',
				dimensions: ['timestamp', 'Meta'],
				timeSeriesMode: 'breakdown'
			})[0]
		).not.toHaveProperty('showSymbol')
		expect(
			buildRWAPerpsTimeSeriesCharts({
				metric: 'openInterest',
				dimensions: ['timestamp', 'Meta'],
				timeSeriesMode: 'breakdown'
			})[0]
		).not.toHaveProperty('stack')
	})

	it('builds a grouped time-series series for total mode', () => {
		expect(
			buildRWAPerpsTimeSeriesCharts({
				metric: 'openInterest',
				dimensions: ['timestamp', 'Total'],
				timeSeriesMode: 'grouped'
			})
		).toEqual([
			{
				name: 'Total',
				type: 'line',
				encode: { x: 'timestamp', y: 'Total' },
				color: expect.any(String)
			}
		])
	})

	it('adds a plain total overlay line for breakdown line charts', () => {
		expect(
			buildRWAPerpsTimeSeriesCharts({
				metric: 'openInterest',
				dimensions: ['timestamp', 'Total', 'Meta', 'NVIDIA'],
				timeSeriesMode: 'breakdown'
			})
		).toEqual([
			{
				name: 'Meta',
				type: 'line',
				encode: { x: 'timestamp', y: 'Meta' },
				color: CHART_COLORS[1]
			},
			{
				name: 'NVIDIA',
				type: 'line',
				encode: { x: 'timestamp', y: 'NVIDIA' },
				color: CHART_COLORS[2]
			},
			{
				name: 'Total',
				type: 'line',
				encode: { x: 'timestamp', y: 'Total' },
				color: CHART_COLORS[0],
				hideAreaStyle: true,
				excludeFromTooltipTotal: true
			}
		])
	})

	it('does not add a total overlay line for breakdown bar charts', () => {
		expect(
			buildRWAPerpsTimeSeriesCharts({
				metric: 'volume24h',
				dimensions: ['timestamp', 'Total', 'Meta', 'NVIDIA'],
				timeSeriesMode: 'breakdown'
			})
		).toEqual([
			{
				name: 'Total',
				type: 'bar',
				stack: 'A',
				large: false,
				encode: { x: 'timestamp', y: 'Total' },
				color: CHART_COLORS[0]
			},
			{
				name: 'Meta',
				type: 'bar',
				stack: 'A',
				large: false,
				encode: { x: 'timestamp', y: 'Meta' },
				color: CHART_COLORS[1]
			},
			{
				name: 'NVIDIA',
				type: 'bar',
				stack: 'A',
				large: false,
				encode: { x: 'timestamp', y: 'NVIDIA' },
				color: CHART_COLORS[2]
			}
		])
	})

	it('renders 24h changes inline on the overview open interest and volume cards', () => {
		const html = renderToStaticMarkup(<RWAPerpsDashboard mode="overview" data={overviewData} />)

		expect(html).toContain('+25.00%')
		expect(html).toContain('-10.00%')
	})

	it('renders 24h open interest and volume changes on venue stat cards', () => {
		const html = renderToStaticMarkup(<RWAPerpsDashboard mode="venue" data={venueData} />)

		expect(html).toContain('+25.00%')
		expect(html).toContain('-10.00%')
	})

	it('defaults direct CEX venues and assets on while asset groups remain off', () => {
		const cexVenueData = {
			...venueData,
			venue: 'binance',
			markets: [cexMarket]
		} satisfies IRWAPerpsVenuePageData
		const venueHtml = renderToStaticMarkup(<RWAPerpsDashboard mode="venue" data={cexVenueData} />)

		expect(venueHtml).toContain('CEX Venues')
		expect(getLastTableWithSearchProps().data).toEqual([cexMarket])

		const cexAssetData = {
			...assetData,
			markets: [cexMarket]
		} satisfies IRWAPerpsAssetPageData
		const assetHtml = renderToStaticMarkup(<RWAPerpsDashboard mode="asset" data={cexAssetData} />)

		expect(assetHtml).toContain('CEX Venues')
		expect(getLastTableWithSearchProps().data).toEqual([cexMarket])
		expect(getLastUseQueryOptions().queryKey).toEqual([
			'rwa-perps-chart',
			{
				source: 'market-breakdown',
				key: 'openInterest',
				target: { kind: 'baseAsset', slug: 'Meta' },
				includeCex: true
			}
		])

		const cexAssetGroupData = {
			...assetGroupData,
			markets: [cexMarket]
		} satisfies IRWAPerpsAssetGroupPageData
		const assetGroupHtml = renderToStaticMarkup(<RWAPerpsDashboard mode="assetGroup" data={cexAssetGroupData} />)

		expect(assetGroupHtml).toContain('CEX Venues')
		expect(getLastTableWithSearchProps().data).toEqual([])
	})
})
