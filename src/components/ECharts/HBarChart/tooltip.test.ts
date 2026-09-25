import { expect, test } from 'vitest'
import { formatHBarTooltip } from './tooltip'

const textOf = (html: string) => html.replace(/<[^>]+>/g, '')

test('shows the hovered bar value for a single-series chart', () => {
	expect(textOf(formatHBarTooltip([{ name: 'A', seriesName: 'Series', value: 20 }], false, '$'))).toBe('A$20')
})

test('lists every grouped series at the hovered category with its own value', () => {
	const tooltip = formatHBarTooltip(
		[
			{ name: 'Ethereum', seriesName: 'Revenue', marker: '•', value: 10 },
			{ name: 'Ethereum', seriesName: 'Users', marker: '•', value: 20 }
		],
		true,
		'$'
	)

	expect(textOf(tooltip)).toBe('Ethereum•Revenue: $10•Users: $20')
})
