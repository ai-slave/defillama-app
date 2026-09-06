import type { MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import type { PreIpoCompanyListItem, PreIpoCompanySummary, PreIpoIntegrations, PreIpoRaise } from './api.types'

export type PreIpoOverviewPageProps = {
	companies: Array<PreIpoCompanyListItem>
	updatedAt: string
}

export type PreIpoValuationChart = {
	dataset: MultiSeriesChartDataset
	charts: Array<MultiSeriesChartSeriesConfig>
	xAxisMaxTimestamp: number
}

export type PreIpoCompanyPageProps = {
	summary: PreIpoCompanySummary
	raises: Array<PreIpoRaise>
	integrations: PreIpoIntegrations
	chart: PreIpoValuationChart | null
	valuationDataUpdatedAt: string
	marketDataUpdatedAt: string
}
