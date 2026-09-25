import { assert, describe, expect, test } from 'vitest'
import {
	getIrTabMenuItems,
	getMainSiteIrDashboard,
	getMainSiteIrTabHref,
	hasMainSiteIrDashboard,
	isMainSiteIrVisible,
	MAIN_SITE_IR_DASHBOARDS,
	resolveMainSiteIrTab
} from '../mainSiteDashboards'
import { getDashboardModule, isDashboardRegistered } from '../registry'

describe('mainSiteDashboards', () => {
	test('finds a dashboard by the main-site slug, not the IR project id', () => {
		expect(getMainSiteIrDashboard('protocol', 'odyssey-finance')?.irProjectId).toBe('odyssey-ecosystem')
		expect(getMainSiteIrDashboard('protocol', 'odyssey-ecosystem')).toBeUndefined()
		// One dashboard can sit on both entity pages.
		expect(getMainSiteIrDashboard('chain', 'near')?.dashboardId).toBe('n34rr3v3nu3d4sh')
		expect(getMainSiteIrDashboard('protocol', 'near')?.dashboardId).toBe('n34rr3v3nu3d4sh')
	})

	test('resolves a dashboard only under its own entity type', () => {
		expect(hasMainSiteIrDashboard('protocol', 'spark')).toBe(true)
		expect(hasMainSiteIrDashboard('chain', 'spark')).toBe(false)
		expect(hasMainSiteIrDashboard('chain', 'sonic')).toBe(true)
		expect(hasMainSiteIrDashboard('protocol', 'sonic')).toBe(false)
		expect(hasMainSiteIrDashboard('protocol', 'aave')).toBe(false)
	})

	// mainSiteDashboards is intentionally decoupled from registry.ts, so an unregistered dashboardId
	// would not error — InvestorRelationsView would silently fall back to DEFAULT_TABS and render a
	// blank custom view. This guard turns that drift into a test failure.
	test('maps every dashboardId to a module registered in registry.ts', () => {
		for (const dashboard of MAIN_SITE_IR_DASHBOARDS) {
			expect(isDashboardRegistered(dashboard.dashboardId), `dashboardId ${dashboard.dashboardId} not in registry`).toBe(
				true
			)
		}
	})

	test('shows a llama-only dashboard to llamas alone and a public one to everyone', () => {
		const uniswap = getMainSiteIrDashboard('protocol', 'uniswap')!
		expect(isMainSiteIrVisible(uniswap, false)).toBe(true)
		expect(isMainSiteIrVisible({ ...uniswap, llamaOnly: true }, false)).toBe(false)
		expect(isMainSiteIrVisible({ ...uniswap, llamaOnly: true }, true)).toBe(true)
	})

	test('menu tab lists match the tabs of the registered module', async () => {
		const menuDashboards = MAIN_SITE_IR_DASHBOARDS.flatMap((dashboard) =>
			dashboard.tabPlacement === 'menu' ? [dashboard] : []
		)
		expect(menuDashboards.length).toBeGreaterThan(0)
		for (const dashboard of menuDashboards) {
			const mod = await getDashboardModule(dashboard.dashboardId)
			expect(mod?.tabs.map(({ id, label }) => ({ id, label }))).toEqual(
				dashboard.menuTabs.map(({ id, label }) => ({ id, label }))
			)
		}
	})

	test('routes the first menu tab to the base href and the others to a tab segment', () => {
		const uniswap = getMainSiteIrDashboard('protocol', 'uniswap')!
		expect(getMainSiteIrTabHref(uniswap, 'overview')).toBe('/protocol/deep-dive/uniswap')
		expect(getMainSiteIrTabHref(uniswap, 'liquidity')).toBe('/protocol/deep-dive/uniswap/liquidity')
		expect(getMainSiteIrTabHref(getMainSiteIrDashboard('protocol', 'spark')!, 'anything')).toBe(
			'/protocol/investor-relations/spark'
		)
	})

	test('resolves the tab segment of a menu dashboard', () => {
		const uniswap = getMainSiteIrDashboard('protocol', 'uniswap')!
		expect(resolveMainSiteIrTab(uniswap, undefined)).toEqual({ type: 'tab', tabId: 'overview' })
		expect(resolveMainSiteIrTab(uniswap, 'security')).toEqual({ type: 'tab', tabId: 'security' })
		expect(resolveMainSiteIrTab(uniswap, 'overview')).toEqual({
			type: 'redirect',
			destination: '/protocol/deep-dive/uniswap'
		})
		expect(resolveMainSiteIrTab(uniswap, 'nope')).toEqual({ type: 'not-found' })
	})

	test('a single-tab dashboard accepts no tab segment', () => {
		const spark = getMainSiteIrDashboard('protocol', 'spark')!
		expect(resolveMainSiteIrTab(spark, undefined)).toEqual({ type: 'tab', tabId: null })
		expect(resolveMainSiteIrTab(spark, 'overview')).toEqual({ type: 'not-found' })
	})

	test('links the Uniswap Deep Dive menu to each page and marks only the open one', () => {
		const uniswap = getMainSiteIrDashboard('protocol', 'uniswap')!
		assert(uniswap.tabPlacement === 'menu')
		const pages = (active: boolean, activeTabId: string | undefined) =>
			getIrTabMenuItems(uniswap, active, activeTabId).map(({ label, href, isActive }) => ({ label, href, isActive }))
		const open = pages(true, 'liquidity')
		// The first page is the dashboard root, so its link carries no tab segment.
		expect(open[0]).toEqual({ label: 'Overview', href: '/protocol/deep-dive/uniswap', isActive: false })
		expect(open.filter((page) => page.isActive)).toEqual([
			{ label: 'Liquidity Depth', href: '/protocol/deep-dive/uniswap/liquidity', isActive: true }
		])
		// On another protocol tab (e.g. Fees) the menu still lists the pages but marks none.
		expect(pages(false, 'liquidity').filter((page) => page.isActive)).toEqual([])
	})
})
