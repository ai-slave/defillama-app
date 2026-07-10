import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
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
	it('describes slice tones and renders warning and negative segments without dashed spikes', () => {
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
		expect(html).toContain('fill="var(--warning)"')
		expect(html).not.toContain('stroke-dasharray')
	})

	it('splits the Value Accrual label across two lines', () => {
		const html = renderToStaticMarkup(<TokenRightsPieChart segments={ACTIVE_SEGMENTS} />)

		expect(html).toContain('Governance: positive')
		expect(html).toContain('<tspan')
		expect(html).toContain('Value</tspan>')
		expect(html).toContain('Accrual</tspan>')
	})

	it('uses the same wedge geometry without labels for compact pies', () => {
		const html = renderToStaticMarkup(<TokenRightsPieChart segments={ACTIVE_SEGMENTS} showLabels={false} />)

		expect(html.match(/<path/g)).toHaveLength(6)
		expect(html).not.toContain('<text')
	})
})
