import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { TokenRightsPieChart } from '../TokenRightsPieChart'

describe('TokenRightsPieChart', () => {
	test('describes slice tones for assistive technology', () => {
		const html = renderToStaticMarkup(
			<TokenRightsPieChart
				tones={{
					treasury: 'positive',
					revenue: 'negative',
					burns: 'positive',
					equity: 'warning',
					valueAccrual: 'positive',
					governance: 'positive'
				}}
			/>
		)

		expect(html).toContain('Treasury: positive; Revenue: negative')
		expect(html).toContain('Equity: warning; Value Accrual: positive')
	})
})
