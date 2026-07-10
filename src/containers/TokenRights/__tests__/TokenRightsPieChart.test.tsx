import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TokenRightsPieChart } from '../TokenRightsPieChart'

const ACTIVE_SEGMENTS = [
	{ label: 'Treasury', active: true },
	{ label: 'Revenue', active: true },
	{ label: 'Burns', active: true },
	{ label: 'Dividends', active: true },
	{ label: 'Buybacks', active: true },
	{ label: 'Governance', active: true }
]

describe('TokenRightsPieChart', () => {
	it('describes active and inactive rights and patterns inactive segments', () => {
		const html = renderToStaticMarkup(
			<TokenRightsPieChart segments={ACTIVE_SEGMENTS.map((segment, index) => ({ ...segment, active: index !== 1 }))} />
		)

		expect(html).toContain('Treasury: active; Revenue: inactive')
		expect(html).toContain('stroke-dasharray="6 4"')
	})

	it('keeps fully active pies solid', () => {
		const html = renderToStaticMarkup(<TokenRightsPieChart segments={ACTIVE_SEGMENTS} />)

		expect(html).toContain('Governance: active')
		expect(html).not.toContain('stroke-dasharray')
	})
})
