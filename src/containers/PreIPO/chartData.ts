import type { PreIpoRaise, PreIpoValuation } from './api.types'
import type { PreIpoValuationChart } from './types'

const MONTHLY_VALUATION_COLOR = '#2f80ed'
const ROUND_VALUATION_COLOR = '#f97316'
const RAISED_COLOR = '#10b981'

function utcDateTimestamp(date: string): number {
	return new Date(`${date}T00:00:00.000Z`).getTime()
}

export function buildPreIpoValuationChart(
	valuations: PreIpoValuation[],
	raises: PreIpoRaise[]
): PreIpoValuationChart | null {
	if (valuations.length === 0) return null

	const valuationData: Array<[number, number]> = []
	for (const valuation of valuations) {
		valuationData.push([utcDateTimestamp(valuation.date), valuation.estimatedValuation])
	}

	const roundValuationData: Array<[number, number | null]> = []
	const raisedData: Array<[number, number]> = []
	for (const raise of raises) {
		const timestamp = utcDateTimestamp(raise.date)
		roundValuationData.push([timestamp, raise.valuation])
		raisedData.push([timestamp, raise.amountRaised])
	}

	return {
		dataset: { dimensions: ['timestamp'], source: [] },
		charts: [
			{
				type: 'line',
				name: 'Monthly valuation',
				encode: { x: 0, y: 1 },
				data: valuationData,
				color: MONTHLY_VALUATION_COLOR,
				hideAreaStyle: true
			},
			{
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
			},
			{
				type: 'bar',
				name: 'Raised',
				encode: { x: 0, y: 1 },
				data: raisedData,
				color: RAISED_COLOR,
				barMaxWidth: 16
			}
		]
	}
}
