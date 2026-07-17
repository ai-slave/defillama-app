import type { MultiSeriesChart2Dataset, MultiSeriesChart2SeriesConfig } from '~/components/ECharts/types'
import type {
	IEquitiesCompanyApiItem,
	IEquitiesDimensionsResponse,
	IEquitiesFilingApiItem,
	IEquitiesMetadataResponse,
	IEquitiesOnchainPerpApiItem,
	IEquitiesOnchainTokenApiItem,
	IEquitiesStatementsResponse,
	IEquitiesSummaryResponse
} from './api.types'

export interface IEquitiesPriceHistoryChart {
	dataset: MultiSeriesChart2Dataset
	charts: MultiSeriesChart2SeriesConfig[]
}

export interface IEquitiesListCompanyRow extends IEquitiesCompanyApiItem {
	href: string
}

export interface IEquitiesListPageProps {
	companies: IEquitiesListCompanyRow[]
	updatedAt?: string | null
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
	priceHistoryChart: IEquitiesPriceHistoryChart
	statements: IEquitiesStatementsResponse
	dimensions: IEquitiesDimensionsResponse
	filings: IEquitiesFilingApiItem[]
	filingForms: string[]
	onchain: IEquitiesOnchainPageData
	unlocksSlug: string | null
}
