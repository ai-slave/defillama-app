import type { ScatterChartDatum, ScatterChartValue, YieldScatterChartPoint } from './types'

export function isYieldScatterChartPoint(point: ScatterChartDatum): point is YieldScatterChartPoint {
	return !Array.isArray(point) && 'projectName' in point
}

/**
 * Yield pools become one scatter series per project, in first-seen project order, so interleaved input
 * still colors each project consistently. Pools without both risk (sigma) and return (mu) are skipped.
 */
export function groupYieldScatterPoints(chartData: Array<ScatterChartDatum>): Map<string, Array<ScatterChartValue>> {
	const pointsByProject = new Map<string, Array<ScatterChartValue>>()
	for (const point of chartData) {
		if (!isYieldScatterChartPoint(point)) continue
		if (typeof point.sigma !== 'number' || typeof point.mu !== 'number') continue
		let points = pointsByProject.get(point.projectName)
		if (!points) {
			points = []
			pointsByProject.set(point.projectName, points)
		}
		points.push([point.sigma, point.mu, point.count, point.symbol, point.pool, point.tvlUsd, point.apy, point.chain])
	}
	return pointsByProject
}
