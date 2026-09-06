import type { MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'

export interface IHackRow {
	chains: Array<string>
	classification: string
	date: number | null
	target: string | null
	amountUsd: number | null
	name: string
	technique: string
	bridge: boolean
	language: string
}

export interface IHacksPageData {
	data: Array<IHackRow>
	monthlyHacksChartData: { dataset: MultiSeriesChartDataset; charts: Array<MultiSeriesChartSeriesConfig> }
	totalHacked: string
	totalHackedDefi: string
	totalRugs: string
	pieChartData: Array<{ name: string; value: number }>
	chainOptions: Array<string>
	techniqueOptions: Array<string>
	classificationOptions: Array<string>
}

export interface IProtocolTotalValueLostInHacksByProtocol {
	protocols: Array<{
		name: string
		slug: string
		route: string | null
		totalHackedUsd: number
		returnedFundsUsd: number
	}>
}
