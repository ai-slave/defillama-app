import { describe, expect, test } from 'vitest'
import type { ChartConfig } from '../../../chartConfig'
import { classifyColumns } from '../../../columnKind'
import type { QueryResult } from '../../../exportResults'
import { buildLineBarChart, buildSqlChartModel } from '../LineBarChart'

function series(name: string, sourceIndex = 1) {
	return {
		name,
		sourceIndex,
		type: 'line' as const,
		color: '#123456'
	}
}

describe('SQL line/bar chart model', () => {
	test('separates user display names from time and value dimensions', () => {
		const model = buildSqlChartModel([[Date.UTC(2026, 0, 1), 7]], 0, 'time', [series('timestamp')])

		expect(model.dataset).toEqual({
			dimensions: ['x', 'timestamp'],
			source: [[1_767_225_600_000, 7]]
		})
		expect(model.charts[0]).toMatchObject({
			name: 'timestamp',
			encode: { x: 0, y: 1 }
		})
	})
})

// One day of fees split by chain; returns the visible tooltip text for that day.
function hoverSplitDay(fees: Array<[chain: string, fee: number]>) {
	const result: QueryResult = {
		columns: [
			{ name: 'day', type: 'TIMESTAMP' },
			{ name: 'chain', type: 'VARCHAR' },
			{ name: 'fee', type: 'DOUBLE' }
		],
		rows: fees.map(([chain, fee]) => [1_767_225_600_000, chain, fee])
	}
	const config: ChartConfig = {
		chartType: 'line',
		xCol: 'day',
		yCols: ['fee'],
		splitByCol: 'chain',
		stackMode: 'off',
		rightAxisCols: [],
		seriesKinds: {},
		seriesColors: {},
		numberFormat: 'currency'
	}
	const { chartModel, chartOptions, truncatedCount } = buildLineBarChart(config, result, classifyColumns(result), {})
	const row = chartModel.dataset.source[0]!
	const formatter = (chartOptions.tooltip as unknown as { formatter: (params: unknown) => string }).formatter
	const html = formatter(
		chartModel.charts.map((chart) => ({
			seriesName: chart.name,
			marker: '',
			axisValue: row[0],
			value: row,
			encode: { x: [0], y: [chart.encode.y] }
		}))
	)
	return { truncatedCount, text: html.replace(/<[^>]+>/g, '|').replaceAll('&nbsp;', ' ') }
}

test('folds the pivot remainder into the tooltip Others row when a split has more than 20 series', () => {
	// 22 chains of $10: two are folded into a $20 "Other" series, which must not show as the largest row.
	const { truncatedCount, text } = hoverSplitDay(Array.from({ length: 22 }, (_, i) => [`chain-${i}`, 10]))

	expect(truncatedCount).toBe(2)
	expect(text).toContain('|Others  $130|')
	expect(text).not.toContain('|Other  $20|')
})

test('shows a user series named Other as an ordinary row when nothing was folded', () => {
	const { truncatedCount, text } = hoverSplitDay([
		['Other', 30],
		['Base', 10]
	])

	expect(truncatedCount).toBe(0)
	expect(text).toContain('|Other  $30|')
	expect(text).toContain('|Base  $10|')
	expect(text).not.toContain('Others')
})

test('leads a category tooltip with the pointed series even when it falls past the ten rows', () => {
	// Twelve tokens on one chain: token-0 = $120 down to token-11 = $10.
	const result: QueryResult = {
		columns: [
			{ name: 'chain', type: 'VARCHAR' },
			{ name: 'token', type: 'VARCHAR' },
			{ name: 'fee', type: 'DOUBLE' }
		],
		rows: Array.from({ length: 12 }, (_, i) => ['Ethereum', `token-${i}`, (12 - i) * 10])
	}
	const config: ChartConfig = {
		chartType: 'bar',
		xCol: 'chain',
		yCols: ['fee'],
		splitByCol: 'token',
		stackMode: 'off',
		rightAxisCols: [],
		seriesKinds: {},
		seriesColors: {},
		numberFormat: 'currency'
	}
	const { chartModel, chartOptions } = buildLineBarChart(config, result, classifyColumns(result), {})
	const row = chartModel.dataset.source[0]!
	const formatter = (chartOptions.tooltip as unknown as { formatter: (params: unknown) => string }).formatter
	const text = formatter(
		chartModel.charts.map((chart) => ({
			seriesName: chart.name,
			marker: '',
			axisValue: row[0],
			value: row,
			encode: { x: [0], y: [chart.encode.y] },
			pointed: chart.name === 'token-11'
		}))
	)
		.replace(/<[^>]+>/g, '|')
		.replaceAll('&nbsp;', ' ')

	expect(text.indexOf('|token-11  $10|')).toBeGreaterThan(-1)
	expect(text.indexOf('|token-11  $10|')).toBeLessThan(text.indexOf('|token-0  $120|'))
	expect(text).toContain('|token-8  $40|')
	expect(text).not.toContain('token-9')
})
