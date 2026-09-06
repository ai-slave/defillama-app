import { describe, expect, test } from 'vitest'
import {
	getMainSiteIrDashboard,
	hasMainSiteIrDashboard,
	MAIN_SITE_IR_CHAIN_SLUGS,
	MAIN_SITE_IR_DASHBOARDS,
	MAIN_SITE_IR_PROTOCOL_SLUGS
} from '../mainSiteDashboards'
import { isDashboardRegistered } from '../registry'

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
		expect(new Set(MAIN_SITE_IR_PROTOCOL_SLUGS)).toEqual(new Set(['spark', 'odyssey-finance', 'near', 'thorchain']))
		expect(new Set(MAIN_SITE_IR_CHAIN_SLUGS)).toEqual(new Set(['near', 'sonic', 'thorchain', 'flare']))
		expect(MAIN_SITE_IR_DASHBOARDS).toHaveLength(8)
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
		for (const dashboard of MAIN_SITE_IR_DASHBOARDS) {
			expect(dashboard.tabLabel).toBe('Enterprise')
		}
	})
})
