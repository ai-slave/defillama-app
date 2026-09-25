import { describe, expect, test } from 'vitest'
import { resolveActiveTab, resolveEmbeddedDashboardTabs } from './dashboardTabs'

const TABS = [
	{ id: 'revenue', label: 'Revenue' },
	{ id: 'holders', label: 'Holders' }
]

describe('resolveActiveTab', () => {
	test('keeps a selection that the tabs still have', () => {
		expect(resolveActiveTab(TABS, 'holders')).toBe('holders')
	})

	test('starts from the first tab without a selection or when the selection is gone', () => {
		expect(resolveActiveTab(TABS, null)).toBe('revenue')
		expect(resolveActiveTab(TABS, 'other-dashboard-tab')).toBe('revenue')
	})

	test('falls back to the dashboard tab when there are no tabs', () => {
		expect(resolveActiveTab([], 'holders')).toBe('dashboard')
	})
})

describe('resolveEmbeddedDashboardTabs', () => {
	test('an unregistered dashboard shows the Overview tab without loading', () => {
		expect(
			resolveEmbeddedDashboardTabs({
				registered: false,
				loadedModule: undefined,
				selectedTab: null,
				controlledTab: undefined
			})
		).toEqual({ tabs: [{ id: 'dashboard', label: 'Overview' }], activeTab: 'dashboard' })
	})

	test('a registered dashboard has no tabs until its module loads', () => {
		expect(
			resolveEmbeddedDashboardTabs({
				registered: true,
				loadedModule: undefined,
				selectedTab: 'holders',
				controlledTab: undefined
			}).tabs
		).toBeNull()
	})

	test('a loaded module supplies the tabs and the selection picks among them', () => {
		expect(
			resolveEmbeddedDashboardTabs({
				registered: true,
				loadedModule: { tabs: TABS },
				selectedTab: 'holders',
				controlledTab: undefined
			})
		).toEqual({ tabs: TABS, activeTab: 'holders' })
		expect(
			resolveEmbeddedDashboardTabs({
				registered: true,
				loadedModule: { tabs: TABS },
				selectedTab: null,
				controlledTab: undefined
			}).activeTab
		).toBe('revenue')
	})

	test('a registered dashboard whose module is missing falls back to the Overview tab', () => {
		expect(
			resolveEmbeddedDashboardTabs({
				registered: true,
				loadedModule: null,
				selectedTab: null,
				controlledTab: undefined
			})
		).toEqual({ tabs: [{ id: 'dashboard', label: 'Overview' }], activeTab: 'dashboard' })
	})

	test('a controlled tab wins over the selection, loaded or not', () => {
		expect(
			resolveEmbeddedDashboardTabs({
				registered: true,
				loadedModule: { tabs: TABS },
				selectedTab: 'revenue',
				controlledTab: 'holders'
			}).activeTab
		).toBe('holders')
		expect(
			resolveEmbeddedDashboardTabs({
				registered: true,
				loadedModule: undefined,
				selectedTab: null,
				controlledTab: 'holders'
			})
		).toEqual({ tabs: null, activeTab: 'holders' })
	})
})
