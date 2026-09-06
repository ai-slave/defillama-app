import { describe, expect, test } from 'vitest'
import {
	borrowApyCharts,
	borrowApyDimensions,
	netBorrowApyCharts,
	netBorrowApyDimensions,
	supplyApy7dCharts,
	supplyApy7dDimensions,
	supplyApyCharts,
	supplyApyDimensions,
	tvlApyCharts,
	tvlApyDimensions
} from './yieldChartConfig'

const chartContracts = [
	['TVL and APY', tvlApyCharts, tvlApyDimensions],
	['supply APY', supplyApyCharts, supplyApyDimensions],
	['7d supply APY', supplyApy7dCharts, supplyApy7dDimensions],
	['borrow APY', borrowApyCharts, borrowApyDimensions],
	['net borrow APY', netBorrowApyCharts, netBorrowApyDimensions]
] as const

describe('Yields chart contracts', () => {
	test.each(chartContracts)('%s series match the canonical dataset dimensions', (_name, charts, dimensions) => {
		expect(dimensions[0]).toBe('timestamp')
		expect(charts.map((chart) => chart.encode.x)).toEqual(charts.map(() => 0))
		expect(charts.map((chart) => chart.encode.y)).toEqual(dimensions.slice(1).map((_dimension, index) => index + 1))
	})
})
