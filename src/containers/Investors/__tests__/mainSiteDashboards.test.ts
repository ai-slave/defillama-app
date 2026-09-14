import { describe, expect, test } from 'vitest'
import {
	getMainSiteIrDashboard,
	getMainSiteIrRoutePrefix,
	getMainSiteIrTabHref,
	hasMainSiteIrDashboard,
	isMainSiteIrVisible,
	MAIN_SITE_IR_CHAIN_SLUGS,
	MAIN_SITE_IR_DASHBOARDS,
	MAIN_SITE_IR_PROTOCOL_SLUGS,
	resolveMainSiteIrTab
} from '../mainSiteDashboards'
import { getDashboardModule, isDashboardRegistered } from '../registry'

describe('mainSiteDashboards', () => {
	test('maps the odyssey-ecosystem dashboard onto the odyssey-finance protocol slug', () => {
		const odyssey = getMainSiteIrDashboard('protocol', 'odyssey-finance')
		expect(odyssey?.irProjectId).toBe('odyssey-ecosystem')
		expect(odyssey?.dashboardId).toBe('0dyss3y3c0sys7m1')
		expect(odyssey?.customOnly).toBe(true)
	})

	test('keeps the Superluminal overview for spark by marking it not customOnly', () => {
		const spark = getMainSiteIrDashboard('protocol', 'spark')
		expect(spark?.dashboardId).toBe('9vn8xp43tdzo6gt')
		expect(spark?.customOnly).toBe(false)
	})

	test('resolves near, sonic, and thorchain as chain dashboards', () => {
		expect(getMainSiteIrDashboard('chain', 'near')?.dashboardId).toBe('n34rr3v3nu3d4sh')
		expect(getMainSiteIrDashboard('chain', 'sonic')?.dashboardId).toBe('s0n1cd4shb0ard1')
		expect(getMainSiteIrDashboard('chain', 'thorchain')?.dashboardId).toBe('bfqwxro9m0xnc9z')
		expect(getMainSiteIrDashboard('chain', 'flare')?.dashboardId).toBe('fl4r3d4shb0ard1')
	})

	test('does not resolve a dashboard under the wrong entity type', () => {
		expect(getMainSiteIrDashboard('chain', 'spark')).toBeUndefined()
		expect(getMainSiteIrDashboard('protocol', 'sonic')).toBeUndefined()
		expect(hasMainSiteIrDashboard('chain', 'spark')).toBe(false)
		expect(hasMainSiteIrDashboard('protocol', 'sonic')).toBe(false)
	})

	test('surfaces near as both a chain and a protocol dashboard', () => {
		expect(getMainSiteIrDashboard('chain', 'near')?.dashboardId).toBe('n34rr3v3nu3d4sh')
		expect(getMainSiteIrDashboard('protocol', 'near')?.dashboardId).toBe('n34rr3v3nu3d4sh')
	})

	test('surfaces thorchain as both a chain and a protocol dashboard', () => {
		expect(getMainSiteIrDashboard('chain', 'thorchain')?.dashboardId).toBe('bfqwxro9m0xnc9z')
		expect(getMainSiteIrDashboard('protocol', 'thorchain')?.dashboardId).toBe('bfqwxro9m0xnc9z')
	})

	test('returns undefined for entities without an IR dashboard', () => {
		expect(getMainSiteIrDashboard('protocol', 'aave')).toBeUndefined()
		expect(hasMainSiteIrDashboard('chain', 'ethereum')).toBe(false)
	})

	test('exposes protocol and chain slug lists that match the dashboard table', () => {
		expect(new Set(MAIN_SITE_IR_PROTOCOL_SLUGS)).toEqual(
			new Set(['spark', 'odyssey-finance', 'near', 'thorchain', 'uniswap'])
		)
		expect(new Set(MAIN_SITE_IR_CHAIN_SLUGS)).toEqual(new Set(['near', 'sonic', 'thorchain', 'flare']))
		expect(MAIN_SITE_IR_DASHBOARDS).toHaveLength(9)
	})

	test('uses a non-empty brand gradient for every dashboard', () => {
		for (const dashboard of MAIN_SITE_IR_DASHBOARDS) {
			expect(dashboard.brandGradient).toContain('gradient')
		}
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

	test('uses the configured dashboard labels', () => {
		const singleTabDashboards = MAIN_SITE_IR_DASHBOARDS.filter((dashboard) => dashboard.tabPlacement === 'single')
		expect(singleTabDashboards.length).toBeGreaterThan(0)
		expect(singleTabDashboards.map((dashboard) => dashboard.tabLabel)).toEqual(
			singleTabDashboards.map(() => 'Enterprise')
		)
	})

	test('surfaces uniswap as a tab menu behind the llama flag', () => {
		const uniswap = getMainSiteIrDashboard('protocol', 'uniswap')
		expect(uniswap?.dashboardId).toBe('un1swapd4shb0rd')
		expect(uniswap?.tabPlacement).toBe('menu')
		expect(uniswap?.tabLabel).toBe('Deep Dive')
		expect(getMainSiteIrRoutePrefix(uniswap!)).toBe('deep-dive')
		expect(getMainSiteIrRoutePrefix(getMainSiteIrDashboard('protocol', 'spark')!)).toBe('investor-relations')
		expect(uniswap?.llamaOnly).toBe(true)
		expect(isMainSiteIrVisible(uniswap!, false)).toBe(false)
		expect(isMainSiteIrVisible(uniswap!, true)).toBe(true)
	})

	test('public dashboards are visible without the llama flag', () => {
		expect(isMainSiteIrVisible(getMainSiteIrDashboard('protocol', 'spark')!, false)).toBe(true)
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
})
