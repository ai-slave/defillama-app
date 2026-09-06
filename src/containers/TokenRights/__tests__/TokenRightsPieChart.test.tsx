import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { TokenRightsPieChart } from '../TokenRightsPieChart'

const ACTIVE_SEGMENTS = [
	{ label: 'Treasury', tone: 'positive' },
	{ label: 'Revenue', tone: 'positive' },
	{ label: 'Burns', tone: 'positive' },
	{ label: 'Equity', tone: 'positive' },
	{ label: 'Value Accrual', tone: 'positive' },
	{ label: 'Governance', tone: 'positive' }
] as const

describe('TokenRightsPieChart', () => {
	test('describes slice tones for assistive technology', () => {
		const html = renderToStaticMarkup(
			<TokenRightsPieChart
				segments={ACTIVE_SEGMENTS.map((segment, index) => ({
					...segment,
					tone: index === 1 ? 'negative' : index === 3 ? 'warning' : 'positive'
				}))}
			/>
		)

		expect(html).toContain('Treasury: positive; Revenue: negative')
		expect(html).toContain('Equity: warning; Value Accrual: positive')
	})
})
