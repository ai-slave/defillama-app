import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ScoresTable } from '../ScoresTable'
import type { PerformanceRow } from '../types'

const rows: PerformanceRow[] = [
	{
		marketMakerId: 'lhava',
		marketMakerName: 'Lhava',
		marketMakerImageUrl: null,
		composite: 10,
		grade: 'A+',
		tradingKpis: 9.5,
		trustIntegration: 8,
		coverageCapabilities: 7.25,
		uptime: 6,
		integrationLevel: 3,
		integrationStatus: 'full',
		activeEngagementsCount: 12,
		medianEngagementsFdv: 250000000
	},
	{
		marketMakerId: 'wintermute',
		marketMakerName: 'Wintermute',
		marketMakerImageUrl: null,
		composite: 5,
		grade: 'C',
		tradingKpis: null,
		trustIntegration: 4,
		coverageCapabilities: 3,
		uptime: 2,
		integrationLevel: 2,
		integrationStatus: 'partial',
		activeEngagementsCount: 5,
		medianEngagementsFdv: null
	},
	{
		marketMakerId: 'gsr',
		marketMakerName: 'GSR',
		marketMakerImageUrl: null,
		composite: 1,
		grade: null,
		tradingKpis: 1,
		trustIntegration: 1,
		coverageCapabilities: 1,
		uptime: 1,
		integrationLevel: 1,
		integrationStatus: 'none',
		activeEngagementsCount: null,
		medianEngagementsFdv: null
	}
]

describe('ScoresTable', () => {
	it('renders a row per market maker with its name', () => {
		const html = renderToStaticMarkup(<ScoresTable rows={rows} onSelectMM={() => {}} />)
		expect(html).toContain('Lhava')
		expect(html).toContain('Wintermute')
		expect(html).toContain('GSR')
	})

	it('formats numeric scores to two decimals', () => {
		const html = renderToStaticMarkup(<ScoresTable rows={rows} onSelectMM={() => {}} />)
		expect(html).toContain('10.00')
		expect(html).toContain('9.50')
	})

	it('renders <5.00 for a composite below 5', () => {
		const html = renderToStaticMarkup(<ScoresTable rows={rows} onSelectMM={() => {}} />)
		expect(html).toContain('&lt;5.00')
	})

	it('renders N/A for a null score', () => {
		const html = renderToStaticMarkup(<ScoresTable rows={rows} onSelectMM={() => {}} />)
		expect(html).toContain('N/A')
	})

	it('renders the integration badge labels', () => {
		const html = renderToStaticMarkup(<ScoresTable rows={rows} onSelectMM={() => {}} />)
		expect(html).toContain('Full')
		expect(html).toContain('Partial')
		expect(html).toContain('None')
	})

	it('renders a Grade column between Market Maker and Composite Score', () => {
		const html = renderToStaticMarkup(<ScoresTable rows={rows} onSelectMM={() => {}} />)
		const order = ['Market Maker', 'Grade', 'Composite Score', 'Trading KPIs', 'Trust', 'Coverage &amp; Capabilities']
		const positions = order.map((label) => html.indexOf(label))
		expect(positions.every((p) => p >= 0)).toBe(true)
		expect([...positions].sort((a, b) => a - b)).toEqual(positions)
	})

	it('renders the API grade as a colored letter', () => {
		const html = renderToStaticMarkup(<ScoresTable rows={rows} onSelectMM={() => {}} />)
		expect(html).toContain('>A+</span>')
		expect(html).toContain('text-success')
		expect(html).toContain('>C</span>')
		expect(html).toContain('text-warning')
	})

	it('falls back to a composite-derived grade when the API grade is missing', () => {
		const html = renderToStaticMarkup(<ScoresTable rows={rows} onSelectMM={() => {}} />)
		expect(html).toContain('>F</span>')
		expect(html).toContain('text-error')
	})

	it('labels the trustIntegration column Trust', () => {
		const html = renderToStaticMarkup(<ScoresTable rows={rows} onSelectMM={() => {}} />)
		expect(html).not.toContain('Trust &amp; Integration')
	})
})
