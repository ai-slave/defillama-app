import type { MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'

export const PORTFOLIO_SERIES_NAME = 'Portfolio Value'

export function buildPortfolioTrendDataset(
	points: Array<{ time: number; accountValue: number; pnl: number }>
): MultiSeriesChartDataset {
	const source = new Array<number[]>(points.length)
	for (let i = 0; i < points.length; i++) {
		const point = points[i]
		source[i] = [point.time, point.accountValue]
	}
	return { source, dimensions: ['timestamp', PORTFOLIO_SERIES_NAME] }
}
