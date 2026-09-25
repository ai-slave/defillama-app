import { describe, expect, test } from 'vitest'
import type { Dashboard } from '~/containers/ProDashboard/dashboardTypes'
import { buildDashboardOgCardProps } from './cardProps'

function dashboard(overrides: Partial<Dashboard> = {}): Dashboard {
	return {
		id: 'd1',
		data: {
			dashboardName: 'Yield Overview',
			items: [
				{ id: 'chart-1', kind: 'chart', type: 'tvl', subjectType: 'protocol', protocol: 'aave' },
				{ id: 'text-1', kind: 'text', content: 'Notes' },
				{ id: 'text-2', kind: 'text', content: 'More' },
				{ id: 'text-3', kind: 'text', content: 'Hidden' }
			]
		},
		visibility: 'public',
		author: { slug: 'llama', displayName: 'Llama Analyst' },
		created: '2026-01-01T00:00:00.000Z',
		updated: '2026-02-01T00:00:00.000Z',
		editedAt: '2026-02-02T00:00:00.000Z',
		...overrides
	} as Dashboard
}

describe('buildDashboardOgCardProps', () => {
	test('titles the card with the dashboard name, author, card count and edit date, and three summary lines', () => {
		expect(buildDashboardOgCardProps(dashboard(), { width: 1200, height: 630 }, [])).toEqual({
			width: 1200,
			height: 630,
			title: 'Yield Overview',
			authorName: 'Llama Analyst',
			metaLine: '4 cards · updated Feb 2, 2026',
			charts: [],
			summaryLines: ['Aave Tvl chart', 'Text note: Notes', 'Text note: More']
		})
	})

	test('falls back to the default name, no author, the updated date and a singular card label', () => {
		const props = buildDashboardOgCardProps(
			dashboard({
				editedAt: undefined,
				author: undefined,
				data: { dashboardName: '', items: [{ id: 't', kind: 'text', content: 'Only' }] }
			} as Partial<Dashboard>),
			{ width: 600, height: 315 },
			[]
		)
		expect(props).toMatchObject({
			title: 'Untitled Dashboard',
			authorName: null,
			metaLine: '1 card · updated Feb 1, 2026'
		})
	})
})
