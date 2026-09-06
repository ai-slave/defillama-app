import type { MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import type { IDATInstitutionHolding, IDATInstitutionMetadata, IDATTransaction } from './api.types'

// ── Overview page (digital-asset-treasuries/index) ──────────────────────

export interface IDATInstitutionOverview extends Omit<IDATInstitutionMetadata, 'holdings'> {
	holdings: Array<{
		name: string
		ticker: string
		amount: number
		cost: number | null
		usdValue: number | null
		avgPrice: number | null
		dominance: number
		color: string
	}>
}

export interface IDATOverviewFlowSeries {
	name: string
	stack: 'asset'
	color: string
	points: ReadonlyArray<readonly [number, number]>
}

export interface IDATOverviewPageProps {
	allAssets: Array<{ label: string; to: string }>
	institutions: Array<IDATInstitutionOverview>
	dailyFlowsByAsset: Record<string, IDATOverviewFlowSeries>
}

// ── By-asset page (digital-asset-treasuries/[asset]) ────────────────────

export interface IDATInstitutionOverviewByAsset extends Omit<
	IDATInstitutionMetadata,
	'holdings' | 'totalUsdValue' | 'totalCost'
> {
	holdings: IDATInstitutionHolding
}

export interface IDATChartPayload {
	charts: Array<MultiSeriesChartSeriesConfig>
	dataset: MultiSeriesChartDataset
}

export interface IDATMNAVChartPayload {
	charts: Array<MultiSeriesChartSeriesConfig>
	dataset: MultiSeriesChartDataset
}

export interface IDATOverviewDataByAssetProps {
	institutions: Array<IDATInstitutionOverviewByAsset>
	asset: string
	metadata: {
		name: string
		ticker: string
		geckoId: string
		companies: number
		totalAmount: number
		totalUsdValue: number
		circSupplyPerc: number
	}
	allAssets: Array<{ label: string; to: string }>
	dailyFlowsChart: IDATChartPayload
	mNAVRealizedChart: IDATMNAVChartPayload
	mNAVRealisticChart: IDATMNAVChartPayload
	mNAVMaxChart: IDATMNAVChartPayload
	institutionsNames: Array<string>
}

// ── Company detail page (digital-asset-treasury/[company]) ──────────────

export interface IDATCompanyAssetBreakdown {
	name: string
	ticker: string
	amount: number
	cost: number | null
	usdValue: number | null
	avgPrice: number | null
}

export interface IDATCompanyChartByAsset {
	asset: string
	name: string
	ticker: string
	holdingsChart: IDATChartPayload
}

export interface IDATTransactionRow extends Omit<IDATTransaction, 'amount' | 'avg_price' | 'usd_value'> {
	amount: number
	avg_price: number | null
	usd_value: number | null
}

export interface IDATCompanyPageProps {
	name: string
	ticker: string
	transactions: Array<IDATTransactionRow>
	price: number
	priceChange24h: number | null
	totalCost: number
	totalUsdValue: number
	firstAnnouncementDate: string | null
	lastAnnouncementDate: string | null
	realized_mNAV: number | null
	realistic_mNAV: number | null
	max_mNAV: number | null
	assets: Array<string>
	assetsBreakdown: Array<IDATCompanyAssetBreakdown>
	chartByAsset: Array<IDATCompanyChartByAsset>
	mNAVChart: IDATChartPayload | null
	fdChart: IDATChartPayload | null
	totalAssetValueChart: IDATChartPayload | null
	ohlcvChartData: Array<[number, number, number, number, number, number]> | null
}
