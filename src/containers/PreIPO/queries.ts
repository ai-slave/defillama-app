import {
	fetchPreIpoCompanies,
	fetchPreIpoCompanySummary,
	fetchPreIpoIntegrations,
	fetchPreIpoRaises,
	fetchPreIpoValuations
} from './api'
import { buildPreIpoValuationChart } from './chartData'
import type { PreIpoCompanyPageProps, PreIpoOverviewPageProps } from './types'

export async function getPreIpoOverviewPageData(): Promise<PreIpoOverviewPageProps> {
	const snapshot = await fetchPreIpoCompanies()
	return { companies: snapshot.data, updatedAt: snapshot.updatedAt }
}

export async function getPreIpoCompanyPageData(company: string): Promise<PreIpoCompanyPageProps> {
	const [summary, valuations, raises, integrations] = await Promise.all([
		fetchPreIpoCompanySummary(company),
		fetchPreIpoValuations(company),
		fetchPreIpoRaises(company),
		fetchPreIpoIntegrations(company)
	])

	return {
		summary: summary.data,
		raises: raises.data,
		integrations: integrations.data,
		chart: buildPreIpoValuationChart(valuations.data, raises.data),
		valuationDataUpdatedAt: summary.updatedAt,
		marketDataUpdatedAt: integrations.updatedAt
	}
}
