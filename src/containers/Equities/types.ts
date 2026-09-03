import type { MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import type { OffsetTablePage } from '~/server/tablePages/types'
import type {
	EquitiesPriceHistory,
	IEquitiesCompanyApiItem,
	IEquitiesDimensionsResponse,
	IEquitiesFilingApiItem,
	IEquitiesMetadataResponse,
	IEquitiesOnchainPerpApiItem,
	IEquitiesOnchainTokenApiItem,
	IEquitiesStatementsResponse,
	IEquitiesSummaryResponse
} from './api.types'
import type { EquitiesTreemapSizeMetric } from './treemapData'

export interface IEquitiesPriceHistoryChart {
	dataset: MultiSeriesChartDataset
	charts: MultiSeriesChartSeriesConfig[]
}

export interface IEquitiesIntradayPriceHistoryChart extends IEquitiesPriceHistoryChart {
	csvDataset: MultiSeriesChartDataset
	timeOnlyAxisLabels: boolean
}

export interface IEquitiesListCompanyRow extends IEquitiesCompanyApiItem {
	href: string
}

export interface EquitiesCategoricalOptions {
	country: string[]
	sector: string[]
	industry: string[]
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
	rows: EquitiesTreemapRow[]
	excludedCount: number
	truncatedCount: number
	/** Companies matching the filters before the size-metric eligibility check. */
	total: number
}

export interface IEquitiesListPageProps {
	initialData: EquitiesTableResponse
	initialDataGeneratedAt: number
}

export interface IEquitiesOnchainMarketRow extends IEquitiesOnchainPerpApiItem {
	exchangeName: string | null
	platformName: string | null
}

export interface IEquitiesOnchainTokenRow extends IEquitiesOnchainTokenApiItem {
	issuerRwaPlatformName: string
}

export interface IEquitiesOnchainPageData {
	perps: IEquitiesOnchainMarketRow[]
	tokens: IEquitiesOnchainTokenRow[]
}

export interface IEquitiesStatementTableRow {
	id: string
	label: string
	values: Array<number | null>
	depth: number
	subRows?: IEquitiesStatementTableRow[]
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
	filings: IEquitiesFilingApiItem[] | null
	filingForms: string[]
	onchain: IEquitiesOnchainPageData | null
	unlocksSlug: string | null
}
