import type { MultiSeriesChart2Dataset } from '~/components/ECharts/types'

export const PORTFOLIO_SERIES_NAME = 'Portfolio Value'

export function buildPortfolioTrendDataset(
	points: Array<{ time: number; accountValue: number; pnl: number }>
): MultiSeriesChart2Dataset {
	const source = new Array<Record<string, number>>(points.length)
	for (let i = 0; i < points.length; i++) {
		const point = points[i]
		source[i] = { timestamp: point.time, [PORTFOLIO_SERIES_NAME]: point.accountValue }
	}
	return { source, dimensions: ['timestamp', PORTFOLIO_SERIES_NAME] }
}
