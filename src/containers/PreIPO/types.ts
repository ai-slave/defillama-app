import type { MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import type { PreIpoCompanyListItem, PreIpoCompanySummary, PreIpoIntegrations, PreIpoRaise } from './api.types'

export type PreIpoOverviewPageProps = {
	companies: PreIpoCompanyListItem[]
	updatedAt: string
}

export type PreIpoValuationChart = {
	dataset: MultiSeriesChartDataset
	charts: MultiSeriesChartSeriesConfig[]
}

export type PreIpoCompanyPageProps = {
	summary: PreIpoCompanySummary
	raises: PreIpoRaise[]
	integrations: PreIpoIntegrations
	chart: PreIpoValuationChart | null
	valuationDataUpdatedAt: string
	marketDataUpdatedAt: string
}
