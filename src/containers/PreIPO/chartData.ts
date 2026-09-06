import type { PreIpoRaise, PreIpoValuation } from './api.types'
import type { PreIpoValuationChart } from './types'

const MONTHLY_VALUATION_COLOR = '#2f80ed'
const ROUND_VALUATION_COLOR = '#f97316'
const RAISED_COLOR = '#10b981'

function utcDateTimestamp(date: string): number {
	return new Date(`${date}T00:00:00.000Z`).getTime()
}

export function buildPreIpoValuationChart(
	valuations: Array<PreIpoValuation>,
	raises: Array<PreIpoRaise>,
	chartEndTimestamp: number
): PreIpoValuationChart | null {
	if (valuations.length === 0 && raises.length === 0) return null

	const charts: PreIpoValuationChart['charts'] = []
	let xAxisMaxTimestamp = chartEndTimestamp

	const valuationData: Array<[number, number]> = []
	for (const valuation of valuations) {
		const timestamp = utcDateTimestamp(valuation.date)
		valuationData.push([timestamp, valuation.estimatedValuation])
		if (timestamp > xAxisMaxTimestamp) xAxisMaxTimestamp = timestamp
	}
	if (valuationData.length > 0) {
		charts.push({
			type: 'line',
			name: 'Monthly valuation',
			encode: { x: 0, y: 1 },
			data: valuationData,
			color: MONTHLY_VALUATION_COLOR,
			hideAreaStyle: true
		})
	}

	const roundValuationData: Array<[number, number]> = []
	const raisedData: Array<[number, number]> = []
	for (const raise of raises.toSorted((a, b) => a.date.localeCompare(b.date))) {
		const timestamp = utcDateTimestamp(raise.date)
		raisedData.push([timestamp, raise.amountRaised])
		// A raise without a disclosed valuation should not interrupt the step series.
		// It still belongs in the funding bars, but there is no valuation observation
		// to plot at this timestamp.
		if (raise.valuation != null) roundValuationData.push([timestamp, raise.valuation])
		if (timestamp > xAxisMaxTimestamp) xAxisMaxTimestamp = timestamp
	}
	if (roundValuationData.length > 0) {
		const lastValuation = roundValuationData[roundValuationData.length - 1]!
		if (lastValuation[0] < xAxisMaxTimestamp) {
			roundValuationData.push([xAxisMaxTimestamp, lastValuation[1]])
		}
		charts.push({
			type: 'line',
			name: 'Round valuation',
			encode: { x: 0, y: 1 },
			data: roundValuationData,
			color: ROUND_VALUATION_COLOR,
			hideAreaStyle: true,
			lineStyle: { type: 'dashed', width: 2 },
			step: 'end',
			showSymbol: true,
			symbol: 'circle',
			symbolSize: 7
		})
	}
	if (raisedData.length > 0) {
		charts.push({
			type: 'bar',
			name: 'Raised',
			encode: { x: 0, y: 1 },
			data: raisedData,
			color: RAISED_COLOR,
			barMaxWidth: 16
		})
	}

	return {
		dataset: { dimensions: ['timestamp'], source: [] },
		charts,
		xAxisMaxTimestamp
	}
}
