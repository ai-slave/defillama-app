import { describe, expect, it } from 'vitest'
import { alignAscendingSeriesData, buildMultiChartSeriesView } from './multiChartSeries'

const FLOW = {
	name: 'Fees',
	baseType: 'bar' as const,
	data: [
		[1, 10],
		[2, -3]
	] as [number, number][]
}
const SNAPSHOT = {
	name: 'TVL',
	baseType: 'area' as const,
	data: [
		[1, 100],
		[2, 90]
	] as [number, number][]
}

describe('buildMultiChartSeriesView', () => {
	it('turns only cumulative flow bars into running-total lines', () => {
		expect(buildMultiChartSeriesView(FLOW, true)).toEqual({
			...FLOW,
			type: 'line',
			data: [
				[1, 10],
				[2, 7]
			],
			areaStyle: { opacity: 0.2 }
		})

		const snapshot = buildMultiChartSeriesView(SNAPSHOT, true)
		expect(snapshot.type).toBe('line')
		expect(snapshot.data).toBe(SNAPSHOT.data)
		expect(snapshot).not.toHaveProperty('areaStyle')
	})

	it('leaves individual flow values as bars', () => {
		const flow = buildMultiChartSeriesView(FLOW, false)
		expect(flow.type).toBe('bar')
		expect(flow.data).toBe(FLOW.data)
		expect(flow).not.toHaveProperty('areaStyle')
	})

	it('zero-fills missing timestamps in a strictly ascending series', () => {
		expect(
			alignAscendingSeriesData(
				[
					[1, 10],
					[3, 30]
				],
				[1, 2, 3]
			)
		).toEqual([
			[1, 10],
			[2, 0],
			[3, 30]
		])
	})
})
