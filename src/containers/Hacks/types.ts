import type { IMultiSeriesChartProps, MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'

export interface IHacksPageData {
	data: Array<{
		chains: string[]
		classification: string
		date: number
		target: string
		amount: number
		name: string
		technique: string
		bridge: boolean
		language: string
	}>
	monthlyHacksChartData: { dataset: MultiSeriesChartDataset; charts: IMultiSeriesChartProps['charts'] }
	totalHacked: string
	totalHackedDefi: string
	totalRugs: string
	pieChartData: Array<{ name: string; value: number }>
	chainOptions: string[]
	techniqueOptions: string[]
	classificationOptions: string[]
}

export interface IProtocolTotalValueLostInHacksByProtocol {
	protocols: Array<{ name: string; slug: string; route: string; totalHacked: number; returnedFunds: number }>
}
