import { describe, expect, test } from 'vitest'
import { getReadOnlyCardMinHeight } from '../components/ChartGrid'
import { migrateDashboardConfig } from '../dashboardConfig/migrate'
import type { PersistedDashboard } from '../dashboardConfig/persisted'
import { buildDashboardLayout, dashboardHasTabs, streamPrefetchItemIds } from '../dashboardLayout/buildDashboardLayout'
import { getDashboardItemHeight } from '../dashboardLayout/cardHeight'
import { resolveDashboardItems } from '../dashboardVariables/resolve'
import { countDashboardWidgets } from '../dashboardWidgets'

const legacyDashboard: PersistedDashboard = {
	id: 'legacy-dashboard',
	slug: 'legacy-dashboard',
	user: 'owner',
	visibility: 'public',
	tags: ['defi'],
	description: 'Written before sections, parameters and heights existed',
	created: '2025-03-01 10:00:00.000Z',
	updated: '2025-06-01 10:00:00.000Z',
	data: {
		dashboardName: 'Legacy overview',
		timePeriod: '365d',
		items: [
			{ id: 'chart-eth', kind: 'chart', chain: 'Ethereum', type: 'tvl', colSpan: 1 },
			{ id: 'chart-aave', kind: 'chart', chain: '', protocol: 'aave', type: 'fees', color: '#cc803e' },
			{
				id: 'multi-1',
				kind: 'multi',
				name: 'Fees comparison',
				items: [
					{ id: 'multi-1-eth', kind: 'chart', chain: 'Ethereum', type: 'fees' },
					{ id: 'multi-1-aave', kind: 'chart', chain: '', protocol: 'aave', type: 'fees' }
				],
				colSpan: 2
			},
			{
				id: 'metric-1',
				kind: 'metric',
				subject: { itemType: 'chain', chain: 'Ethereum' },
				type: 'tvl',
				aggregator: 'latest',
				window: '30d',
				showSparkline: true,
				colSpan: 0.5
			},
			{
				id: 'unified-table-1',
				kind: 'unified-table',
				configVersion: 3,
				strategy: 'protocols',
				rowHeaders: ['parent-protocol', 'protocol'],
				params: { chains: ['Ethereum'] },
				activePresetId: 'revenue-protocols',
				columnOrder: ['name', 'revenue24h'],
				columnVisibility: { name: true, revenue24h: true },
				defaultSorting: [{ id: 'revenue24h', desc: true }]
			},
			{ id: 'text-1', kind: 'text', title: 'Notes', content: '## Overview\n\nSome **markdown** notes' },
			{
				id: 'builder-1',
				kind: 'builder',
				name: 'Top protocols by fees',
				config: {
					metric: 'fees',
					mode: 'chains',
					chains: ['Ethereum', 'Base'],
					categories: [],
					groupBy: 'protocol',
					limit: 10,
					chartType: 'stackedBar',
					displayAs: 'timeSeries',
					chainFilterMode: 'include',
					categoryFilterMode: 'include',
					chainCategoryFilterMode: 'include',
					protocolCategoryFilterMode: 'include'
				},
				colSpan: 2
			}
		]
	}
}

const EXPECTED_IDS = ['chart-eth', 'chart-aave', 'multi-1', 'metric-1', 'unified-table-1', 'text-1', 'builder-1']

describe('old dashboard documents under the new document model', () => {
	const dashboard = migrateDashboardConfig(legacyDashboard)
	const { items } = dashboard.data

	test('migration keeps every legacy card in order and does not invent document-level fields', () => {
		expect(items.map((item) => item.id)).toEqual(EXPECTED_IDS)
		expect(items[1]).toMatchObject({ kind: 'chart', subjectType: 'protocol', protocol: 'aave' })
		expect(items[1]).not.toHaveProperty('chain')
		expect(dashboard.data).not.toHaveProperty('variables')
		expect(dashboard.data).not.toHaveProperty('annotations')
		for (const item of items) {
			expect(item).not.toHaveProperty('height')
			expect(item).not.toHaveProperty('bindings')
		}
	})

	test('the layout is a single headingless group with the same ids in the same order', () => {
		const layout = buildDashboardLayout(items)
		expect(dashboardHasTabs(items)).toBe(false)
		expect(layout.tabs).toBeNull()
		expect(layout.shared).toHaveLength(1)
		expect(layout.shared[0]!.heading).toBeNull()
		expect(layout.shared[0]!.items.map((item) => item.id)).toEqual(EXPECTED_IDS)
		// Text cards have no stream sources, so the prefetch skips them.
		expect(streamPrefetchItemIds(items, 8)).toEqual([
			'chart-eth',
			'chart-aave',
			'multi-1',
			'metric-1',
			'unified-table-1',
			'builder-1'
		])
	})

	test('resolving parameters without variables returns the same items array', () => {
		const resolution = resolveDashboardItems(items, [], {}, null)
		expect(resolution.items).toEqual(items)
		expect(resolution.unavailableByItemId.size).toBe(0)
	})

	test.each(EXPECTED_IDS)('%s sizes like a new card at the default height', (id) => {
		const item = items.find((candidate) => candidate.id === id)
		if (!item || item.kind === 'section') throw new Error(`Missing card ${id}`)
		expect(getDashboardItemHeight(item)).toBe('default')
		expect(getReadOnlyCardMinHeight(item)).toBe(getReadOnlyCardMinHeight({ ...item, height: 'default' }))
	})

	test('every legacy card counts as a widget', () => {
		expect(countDashboardWidgets(items)).toBe(7)
		expect(countDashboardWidgets(legacyDashboard.data.items)).toBe(7)
	})
})
