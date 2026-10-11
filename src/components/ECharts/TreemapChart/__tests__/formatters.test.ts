import { expect, test } from 'vitest'
import { formatNarrativeTreemapLabel, formatNarrativeTreemapTooltip, formatTreemapUsd } from '../formatters'

test('labels a narrative leaf with its name, return, and market cap', () => {
	expect(formatNarrativeTreemapLabel('Aave', [2_500_000_000, 12.5, 3, 100])).toBe(
		'{name|Aave}\nReturn: {apy| 12.5%}\nMarket Cap: {mcap| $2.5b}'
	)
})

test('keeps treemap dollar labels short: one decimal from millions up, whole dollars below', () => {
	expect([formatTreemapUsd(1_234_567), formatTreemapUsd(12_345), formatTreemapUsd(-2_500_000_000)]).toEqual([
		'$1.2M',
		'$12K',
		'-$2.5B'
	])
})

test('a narrative tooltip names the hovered token with its return and market cap', () => {
	expect(
		formatNarrativeTreemapTooltip([{ name: 'All' }, { name: 'AI' }, { name: 'Render' }], [2_500_000_000, 12.5, 3, 100])
	).toBe('Render<br>Return: 12.5%<br>Market Cap: $2.5b<br>')
})

test('hovering a top-level narrative group shows no tooltip', () => {
	expect(formatNarrativeTreemapTooltip([{ name: 'All' }, { name: 'AI' }], [2_500_000_000, 12.5, 3, 100])).toBe('')
})
