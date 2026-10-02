import type { MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import type { OffsetTablePage } from '~/server/tablePages/types'
import type {
	EquitiesPriceHistory,
	IEquitiesEarningsCalendarApiItem,
	IEquitiesCompanyApiItem,
	IEquitiesDimensionsResponse,
	IEquitiesFilingApiItem,
	IEquitiesIndustryApiItem,
	IEquitiesMetadataResponse,
	IEquitiesOnchainPerpApiItem,
	IEquitiesOnchainTokenApiItem,
	IEquitiesSectorApiItem,
	IEquitiesSectorDetailApiResponse,
	IEquitiesSectorOverviewApiResponse,
	IEquitiesStatementsResponse,
	IEquitiesSummaryResponse
} from './api.types'
import type { EquitiesTreemapSizeMetric } from './treemapData'

export interface IEquitiesPriceHistoryChart {
	dataset: MultiSeriesChartDataset
	charts: Array<MultiSeriesChartSeriesConfig>
}

export interface IEquitiesIntradayPriceHistoryChart extends IEquitiesPriceHistoryChart {
	csvDataset: MultiSeriesChartDataset
	timeOnlyAxisLabels: boolean
}

export interface IEquitiesListCompanyRow extends IEquitiesCompanyApiItem {
	href: string
}

export interface EquitiesCategoricalOptions {
	country: Array<string>
	sector: Array<string>
	industry: Array<string>
}

export interface EquitiesTableResponse extends OffsetTablePage<IEquitiesListCompanyRow> {
	schemaVersion: number
	options: EquitiesCategoricalOptions
	updatedAt: string | null
}

/** The subset of company fields the market map reads: identity, grouping, every size metric and every color metric. */
export type EquitiesTreemapRow = Pick<
	IEquitiesCompanyApiItem,
	| 'ticker'
	| 'country'
	| 'name'
	| 'sector'
	| 'industry'
	| 'marketCap'
	| 'revenueTTM'
	| 'earningsTTM'
	| 'ebitdaTTM'
	| 'enterpriseValue'
	| 'cashAndCashEquivalents'
	| 'totalDebt'
	| 'totalAssets'
	| 'totalShareholdersEquity'
	| 'employeeCount'
	| 'priceChangePercentage1d'
	| 'priceChangePercentage7d'
	| 'priceChangePercentage1m'
>

export interface EquitiesTreemapResponse {
	schemaVersion: number
	sizeMetric: EquitiesTreemapSizeMetric
	/** Top rows by `sizeMetric`, already limited to the market map's row cap. */
	rows: Array<EquitiesTreemapRow>
	excludedCount: number
	truncatedCount: number
	/** Companies matching the filters before the size-metric eligibility check. */
	total: number
}

export interface IEquitiesListPageProps {
	initialData: EquitiesTableResponse
	initialDataGeneratedAt: number
}

export type EquitiesPageDataState<T> =
	| { status: 'ready'; data: T; stale: boolean }
	| { status: 'error'; data: null; stale: false }

export interface IEquitiesSectorsData {
	overview: IEquitiesSectorOverviewApiResponse
	sectors: Array<IEquitiesSectorApiItem>
}

export interface IEquitiesIndustriesData {
	overview: IEquitiesSectorOverviewApiResponse
	industries: Array<IEquitiesIndustryApiItem>
}

export interface IEquitiesSectorPageData {
	overview: IEquitiesSectorOverviewApiResponse
	sector: IEquitiesSectorDetailApiResponse
	industries: Array<IEquitiesIndustryApiItem>
	companies: Array<IEquitiesCompanyApiItem>
}

export interface IEquitiesCalendarCompany {
	ticker: string
	name: string
	marketCap: number | null
	sector: string
	sectorSlug: string
	country: string
}

export interface IEquitiesCalendarRow extends IEquitiesEarningsCalendarApiItem {
	name: string
	marketCap: number | null
	sector: string
	sectorSlug: string
	country: string
	href: string | null
}

export interface IEquitiesCalendarData {
	rows: Array<IEquitiesEarningsCalendarApiItem>
	companies: Array<IEquitiesCalendarCompany>
	updatedAt: string | null
}

export interface IEquitiesOnchainMarketRow extends IEquitiesOnchainPerpApiItem {
	exchangeName: string | null
	platformName: string | null
}

export interface IEquitiesOnchainTokenRow extends IEquitiesOnchainTokenApiItem {
	issuerRwaPlatformName: string
}

export interface IEquitiesOnchainPageData {
	perps: Array<IEquitiesOnchainMarketRow>
	tokens: Array<IEquitiesOnchainTokenRow>
}

export interface IEquitiesStatementTableRow {
	id: string
	label: string
	values: Array<number | null>
	depth: number
	subRows?: Array<IEquitiesStatementTableRow>
}

export interface IEquityTickerPageProps {
	ticker: string
	country: string
	slug: string
	name: string
	metadata: IEquitiesMetadataResponse
	summary: IEquitiesSummaryResponse
	priceHistory: EquitiesPriceHistory | null
	statements: IEquitiesStatementsResponse
	dimensions: IEquitiesDimensionsResponse
	filings: Array<IEquitiesFilingApiItem> | null
	filingForms: Array<string>
	onchain: IEquitiesOnchainPageData | null
	unlocksSlug: string | null
}
