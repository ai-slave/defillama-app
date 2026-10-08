import { describe, expect, test } from 'vitest'
import { CHART_COLORS, chartColor } from '~/constants/colors'
import type { DashboardItemConfig } from '../../dashboardItemConfig'
import type { ChartConfig } from '../../types'
import { getChartEntityKey, getDashboardEntityColors, getMultiChartSeriesColors } from '../colorManager'

const chain = (id: string, name: string, type: 'tvl' | 'fees' = 'tvl'): ChartConfig => ({
	id,
	kind: 'chart',
	subjectType: 'chain',
	chain: name,
	type
})
const protocol = (id: string, slug: string, type: 'tvl' | 'fees' = 'tvl'): ChartConfig => ({
	id,
	kind: 'chart',
	subjectType: 'protocol',
	protocol: slug,
	type
})

describe('getDashboardEntityColors', () => {
	test('gives each entity the palette in order of first appearance across cards', () => {
		const items: Array<DashboardItemConfig> = [
			chain('a', 'Ethereum'),
			{ id: 'm', kind: 'multi', name: 'Compare', items: [protocol('b', 'aave'), chain('c', 'Ethereum')] },
			chain('d', 'Base', 'fees')
		]
		expect(getDashboardEntityColors(items)).toEqual({
			'chain:Ethereum': CHART_COLORS[0],
			'protocol:aave': CHART_COLORS[1],
			'chain:Base': CHART_COLORS[2]
		})
	})

	test('keeps a protocol and a chain of the same name apart', () => {
		const colors = getDashboardEntityColors([chain('a', 'Sonic'), protocol('b', 'Sonic')])
		expect(colors[getChartEntityKey(chain('x', 'Sonic'))]).not.toBe(colors[getChartEntityKey(protocol('y', 'Sonic'))])
	})

	test('repeats the palette past its length', () => {
		const items = Array.from({ length: CHART_COLORS.length + 1 }, (_, index) => chain(`c${index}`, `Chain ${index}`))
		expect(getDashboardEntityColors(items)[`chain:Chain ${CHART_COLORS.length}`]).toBe(CHART_COLORS[0])
	})
})

describe('getMultiChartSeriesColors', () => {
	test('uses the dashboard colours while each series is a different entity', () => {
		const items = [protocol('a', 'aave'), chain('b', 'Base')]
		const entityColors = { 'chain:Base': chartColor(0), 'protocol:aave': chartColor(4) }
		expect(getMultiChartSeriesColors(items, entityColors)).toEqual({ a: chartColor(4), b: chartColor(0) })
	})

	test('colours by rank when an entity repeats, and keeps a chosen colour', () => {
		const items = [chain('a', 'Base'), { ...chain('b', 'Base', 'fees'), color: '#123456' }, chain('c', 'Solana')]
		const entityColors = { 'chain:Solana': chartColor(0), 'chain:Base': chartColor(1) }
		expect(getMultiChartSeriesColors(items, entityColors)).toEqual({
			a: chartColor(0),
			b: '#123456',
			c: chartColor(2)
		})
	})

	test('colours by rank when the wrapped palette gives two entities one colour', () => {
		const items = [chain('a', 'Base'), chain('b', 'Solana')]
		const entityColors = { 'chain:Base': chartColor(0), 'chain:Solana': chartColor(CHART_COLORS.length) }
		expect(getMultiChartSeriesColors(items, entityColors)).toEqual({ a: chartColor(0), b: chartColor(1) })
	})
})
