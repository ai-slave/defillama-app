import { describe, expect, test } from 'vitest'
import { getTooltipAxisValue } from '~/components/ECharts/shared/tooltip'
import { getChartTooltipItems, getChartTooltipValue } from '../tooltip'

describe('pool APY tooltip data', () => {
	test('reads positional rows through their numeric ECharts encode', () => {
		const [item] = getChartTooltipItems({
			axisValue: 1_700_000_000_000,
			data: [1_700_000_000_000, 2, 3],
			dataIndex: 0,
			dimensionNames: ['__dimension_0', '__dimension_1', '__dimension_2'],
			encode: { x: [0], y: [2] },
			marker: '',
			name: '2023-11-14',
			seriesName: 'Reward APY',
			value: [1_700_000_000_000, 2, 3]
		})

		expect(getTooltipAxisValue(item!)).toBe(1_700_000_000_000)
		expect(getChartTooltipValue(item!)).toBe(3)
	})
})
