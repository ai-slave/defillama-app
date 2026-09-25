import { expect, test } from 'vitest'
import {
	articleChartDefaultCaption,
	articleChartLatestLabel,
	articleChartValueSymbol,
	buildArticleChartModel
} from '../renderer/articleChartModel'

const DAY = 86_400
const POINTS: Array<[number, number]> = [
	[1_767_225_600, 1200],
	[1_767_225_600 + DAY, 1500]
]
const series = (chartType: string, name = 'Ethereum') => ({
	entityType: 'chain' as const,
	slug: name.toLowerCase(),
	name,
	chartType
})

test('a count metric has no dollar sign in its series, headline, or caption', () => {
	const txs = [series('txs')]
	expect(buildArticleChartModel(txs, [POINTS]).charts.map((chart) => chart.valueSymbol)).toEqual([''])
	expect(articleChartValueSymbol(txs)).toBe('')
	expect(articleChartLatestLabel(txs, POINTS)?.trim()).toBe('1,500')
	expect(articleChartDefaultCaption(txs, ['Ethereum'])).toBe('Ethereum transactions.')
})

test('a USD metric keeps dollar labels and says it is USD-denominated', () => {
	const tvl = [series('tvl')]
	expect(articleChartValueSymbol(tvl)).toBe('$')
	expect(articleChartLatestLabel(tvl, POINTS)).toBe('$1.5K')
	expect(articleChartDefaultCaption(tvl, ['Ethereum'])).toBe('Ethereum tvl, USD-denominated.')
})

test('a chart that mixes metrics gives each series its own unit and no headline value', () => {
	const mixed = [series('tvl'), series('txs')]
	expect(
		buildArticleChartModel(mixed, [POINTS, POINTS]).charts.map((chart) => [chart.name, chart.valueSymbol])
	).toEqual([
		['Ethereum TVL', '$'],
		['Ethereum Transactions', '']
	])
	expect(articleChartLatestLabel(mixed, POINTS)).toBeNull()
	expect(articleChartDefaultCaption(mixed, ['Ethereum'])).toBe('Ethereum tvl / transactions.')
})

test('a series still loading or without points has no headline value and is left out of the chart', () => {
	expect(articleChartLatestLabel([series('medianApy')], undefined)).toBeNull()
	expect(articleChartLatestLabel([series('tvl')], [])).toBeNull()
	const model = buildArticleChartModel(
		[series('tvl'), series('tvl', 'Base'), series('tvl', 'Arbitrum')],
		[undefined, POINTS, []]
	)
	// The remaining series keeps the color of its legend slot, not the next free one.
	expect(model.charts.map((chart) => [chart.name, chart.color])).toEqual([['Base TVL', '#e07b39']])
})
