import { expect, test } from 'vitest'
import { formatPieTooltip, normalizePieTooltipParams } from '../tooltip'

test('shows a slice name and value symbol as text, never as markup', () => {
	const params = normalizePieTooltipParams({
		marker: '',
		name: '<img src=x onerror=alert(1)>',
		value: 1500,
		percent: 25
	})

	expect(formatPieTooltip(params, '<b>ETH</b>')).toBe(
		'&lt;img src=x onerror=alert(1)&gt;: <b>1,500 &lt;b&gt;ETH&lt;/b&gt;</b> (25%)'
	)
})
