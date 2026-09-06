import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { ScoresTable } from '../ScoresTable'
import type { PerformanceRow } from '../types'

const rows: Array<PerformanceRow> = [
	{
		marketMakerId: 'lhava',
		marketMakerName: 'Lhava',
		marketMakerImageUrl: null,
		composite: 10,
		tradingKpis: 9.5,
		trustIntegration: 8,
		coverageCapabilities: 7.25,
		uptime: 6,
		integrationLevel: 3,
		integrationStatus: 'full',
		activeEngagementsCount: 12,
		medianEngagementsFdv: 250_000_000
	},
	{
		marketMakerId: 'wintermute',
		marketMakerName: 'Wintermute',
		marketMakerImageUrl: null,
		composite: 5.25,
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
	test('renders a row per market maker with its name', () => {
		const html = renderToStaticMarkup(<ScoresTable rows={rows} onSelectMM={() => {}} />)
		expect(html).toContain('Lhava')
		expect(html).toContain('Wintermute')
		expect(html).toContain('GSR')
	})

	test('formats numeric scores to two decimals', () => {
		const html = renderToStaticMarkup(<ScoresTable rows={rows} onSelectMM={() => {}} />)
		expect(html).toContain('10.00')
		expect(html).toContain('9.50')
	})

	test('renders <5.00 for a composite below 5', () => {
		const html = renderToStaticMarkup(<ScoresTable rows={rows} onSelectMM={() => {}} />)
		expect(html).toContain('&lt;5.00')
	})

	test('renders N/A for a null score', () => {
		const html = renderToStaticMarkup(<ScoresTable rows={rows} onSelectMM={() => {}} />)
		expect(html).toContain('N/A')
	})

	test('renders the integration badge labels', () => {
		const html = renderToStaticMarkup(<ScoresTable rows={rows} onSelectMM={() => {}} />)
		expect(html).toContain('Full')
		expect(html).toContain('Partial')
		expect(html).toContain('None')
	})

	test('renders a Grade column between Market Maker and Composite Score', () => {
		const html = renderToStaticMarkup(<ScoresTable rows={rows} onSelectMM={() => {}} />)
		const order = ['Market Maker', 'Grade', 'Composite Score', 'Trading KPIs', 'Trust', 'Coverage &amp; Capabilities']
		const positions = order.map((label) => html.indexOf(label))
		expect(positions.every((p) => p >= 0)).toBe(true)
		expect([...positions].sort((a, b) => a - b)).toEqual(positions)
	})

	test('derives the grade from the composite score', () => {
		const html = renderToStaticMarkup(<ScoresTable rows={rows} onSelectMM={() => {}} />)
		expect(html).toContain('>AAA</span>')
		expect(html).toContain('text-success')
		expect(html).toContain('>B</span>')
		expect(html).toContain('text-warning')
		expect(html).toContain('>CCC</span>')
		expect(html).toContain('text-error')
	})

	test('labels the trustIntegration column Trust', () => {
		const html = renderToStaticMarkup(<ScoresTable rows={rows} onSelectMM={() => {}} />)
		expect(html).not.toContain('Trust &amp; Integration')
	})
})
