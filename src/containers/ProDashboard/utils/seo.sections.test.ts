import { describe, expect, test } from 'vitest'
import type { Dashboard } from '../dashboardTypes'
import {
	buildDashboardSeo,
	summarizeDashboardItems,
	summarizeDashboardSections,
	summarizeDashboardVariables
} from './seo'

const dashboard: Dashboard = {
	id: 'dashboard-1',
	user: 'user-1',
	visibility: 'public',
	tags: [],
	description: '',
	created: '2026-01-01T00:00:00.000Z',
	updated: '2026-01-02T00:00:00.000Z',
	data: {
		dashboardName: 'Chain overview',
		variables: [{ id: 'chain', kind: 'chain', label: 'Chain', value: 'Ethereum' }],
		items: [
			{ id: 'overview', kind: 'section', title: '  Overview  ', displayAs: 'heading' },
			{ id: 'chart-1', kind: 'chart', subjectType: 'chain', chain: 'Ethereum', type: 'tvl' },
			{ id: 'fees', kind: 'section', title: 'Fees', description: 'Fee charts', displayAs: 'tab' },
			{ id: 'chart-2', kind: 'chart', subjectType: 'chain', chain: 'Ethereum', type: 'fees' },
			{ id: 'blank', kind: 'section', title: '   ', displayAs: 'heading' }
		]
	}
}

describe('dashboard SEO with sections and parameters', () => {
	test('sections are excluded from item summaries and the item count', () => {
		const seo = buildDashboardSeo(dashboard)
		expect(seo.itemCount).toBe(2)
		expect(seo.itemSummaries.map((item) => item.id)).toEqual(['chart-1', 'chart-2'])
		expect(summarizeDashboardItems(dashboard.data.items).some((item) => item.label.startsWith('Section:'))).toBe(false)
	})

	test('section titles are collected as trimmed plain text, skipping blank ones', () => {
		expect(summarizeDashboardSections(dashboard.data.items)).toEqual(['Overview', 'Fees'])
		expect(summarizeDashboardSections(undefined)).toEqual([])
	})

	test('the fallback description names the sections', () => {
		const seo = buildDashboardSeo(dashboard)
		expect(seo.description).toContain('with 2 cards')
		expect(seo.description).toContain('across Overview, Fees')
	})

	test('the fallback description lists the parameters', () => {
		const seo = buildDashboardSeo({
			...dashboard,
			data: { ...dashboard.data, dashboardName: 'Chains', items: dashboard.data.items.slice(0, 2) }
		})
		expect(seo.description).toContain('across Overview')
		expect(seo.description).toContain('Parameters: Chain = Ethereum')
		expect(seo.description.length).toBeLessThanOrEqual(155)
		expect(summarizeDashboardVariables(dashboard.data.variables)).toBe('Chain = Ethereum')
		expect(summarizeDashboardVariables([])).toBe('')
		expect(summarizeDashboardVariables(undefined)).toBe('')
	})

	test('an explicit description still wins over the structural fallback', () => {
		const seo = buildDashboardSeo({ ...dashboard, description: 'Hand written summary' })
		expect(seo.description).toBe('Hand written summary')
		expect(seo.itemCount).toBe(2)
	})

	test('a dashboard made only of sections is described as empty', () => {
		const seo = buildDashboardSeo({
			...dashboard,
			data: {
				...dashboard.data,
				variables: [],
				items: [{ id: 's', kind: 'section', title: 'Only', displayAs: 'heading' }]
			}
		})
		expect(seo.itemCount).toBe(0)
		expect(seo.itemSummaries).toEqual([])
		expect(seo.description).toBe('Community-built DefiLlama Pro dashboard.')
	})
})
