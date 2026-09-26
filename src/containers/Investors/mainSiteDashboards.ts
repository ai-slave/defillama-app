import type { IIcon } from '~/ui/Icon'
import type { InvestorsProjectId } from './config'

/**
 * Main-site (defillama.com) surfacing of Investor Relations dashboards.
 *
 * This is intentionally independent of the standalone site selected by hostname in `config.ts`.
 * The dashboard modules themselves are loaded through the ungated `registry.ts` by `dashboardId`.
 *
 * Add a row here to surface another entity once its dashboard is ready.
 */

export type IrEntityType = 'protocol' | 'chain'

export type MainSiteIrRoutePrefix = 'investor-relations' | 'deep-dive'

export const DEFAULT_MAIN_SITE_IR_ROUTE_PREFIX: MainSiteIrRoutePrefix = 'investor-relations'

export interface MainSiteIrTab {
	id: string
	label: string
	icon?: IIcon['name']
	description?: string
}

export type MainSiteIrTabPlacement =
	| { tabPlacement: 'single' }
	| { tabPlacement: 'menu'; menuTabs: Array<MainSiteIrTab>; menuTagline: string }

export interface MainSiteIrDashboardBase {
	/** Investors project id (its dashboard module is the one rendered). */
	irProjectId: InvestorsProjectId
	/** Saved ProDashboard id — both the `registry.ts` key and the ProDashboard embed id. */
	dashboardId: string
	/** Which main-site entity this dashboard attaches to. */
	entityType: IrEntityType
	/** Main-site route slug. May differ from `irProjectId` (e.g. odyssey-ecosystem → odyssey-finance). */
	slug: string
	/** Display name. */
	entityName: string
	/** `true` → only custom tabs (no Superluminal Overview embed). */
	customOnly: boolean
	/** CSS gradient used to highlight the tab. */
	brandGradient: string
	/** Tab label on the main site, e.g. "Investor Relations" or "Enterprise Dashboard". */
	tabLabel: string
	llamaOnly?: boolean
	routePrefix?: MainSiteIrRoutePrefix
}

export type MainSiteIrDashboard = MainSiteIrDashboardBase & MainSiteIrTabPlacement

export const MAIN_SITE_IR_DASHBOARDS: Array<MainSiteIrDashboard> = [
	{
		irProjectId: 'spark',
		dashboardId: '9vn8xp43tdzo6gt',
		entityType: 'protocol',
		slug: 'spark',
		entityName: 'Spark',
		customOnly: false,
		brandGradient: 'linear-gradient(90deg, #FA43BD, #FFA930)',
		tabLabel: 'Enterprise',
		tabPlacement: 'single'
	},
	{
		irProjectId: 'near',
		dashboardId: 'n34rr3v3nu3d4sh',
		entityType: 'chain',
		slug: 'near',
		entityName: 'NEAR',
		customOnly: true,
		brandGradient: 'linear-gradient(90deg, #00C1DE, #00E4AA, #00EC97)',
		tabLabel: 'Enterprise',
		tabPlacement: 'single'
	},
	{
		// NEAR exists as both a chain (/chain/Near) and a protocol (/protocol/near); surface IR on both.
		irProjectId: 'near',
		dashboardId: 'n34rr3v3nu3d4sh',
		entityType: 'protocol',
		slug: 'near',
		entityName: 'NEAR',
		customOnly: true,
		brandGradient: 'linear-gradient(90deg, #00C1DE, #00E4AA, #00EC97)',
		tabLabel: 'Enterprise',
		tabPlacement: 'single'
	},
	{
		irProjectId: 'sonic',
		dashboardId: 's0n1cd4shb0ard1',
		entityType: 'chain',
		slug: 'sonic',
		entityName: 'Sonic',
		customOnly: true,
		brandGradient: 'linear-gradient(90deg, #fac461, #fe7d2d, #e3570a)',
		tabLabel: 'Enterprise',
		tabPlacement: 'single'
	},
	{
		irProjectId: 'thorchain',
		dashboardId: 'bfqwxro9m0xnc9z',
		entityType: 'chain',
		slug: 'thorchain',
		entityName: 'THORChain',
		customOnly: true,
		brandGradient: 'linear-gradient(90deg, #00CCFF, #31FD9D)',
		tabLabel: 'Enterprise',
		tabPlacement: 'single'
	},
	{
		irProjectId: 'thorchain',
		dashboardId: 'bfqwxro9m0xnc9z',
		entityType: 'protocol',
		slug: 'thorchain',
		entityName: 'THORChain',
		customOnly: true,
		brandGradient: 'linear-gradient(90deg, #00CCFF, #31FD9D)',
		tabLabel: 'Enterprise',
		tabPlacement: 'single'
	},
	{
		irProjectId: 'flare',
		dashboardId: 'fl4r3d4shb0ard1',
		entityType: 'chain',
		slug: 'flare',
		entityName: 'Flare',
		customOnly: true,
		brandGradient: 'linear-gradient(90deg, #E62058, #FF7A8A)',
		tabLabel: 'Enterprise',
		tabPlacement: 'single'
	},
	{
		irProjectId: 'odyssey-ecosystem',
		dashboardId: '0dyss3y3c0sys7m1',
		entityType: 'protocol',
		slug: 'odyssey-finance',
		entityName: 'Odyssey Ecosystem',
		customOnly: true,
		brandGradient: 'linear-gradient(90deg, #3b82f6, #60a5fa, #93c5fd)',
		tabLabel: 'Enterprise',
		tabPlacement: 'single'
	},
	{
		irProjectId: 'uniswap',
		dashboardId: 'un1swapd4shb0rd',
		entityType: 'protocol',
		slug: 'uniswap',
		entityName: 'Uniswap',
		customOnly: true,
		brandGradient: 'linear-gradient(90deg, #FF007A, #FC72FF)',
		tabLabel: 'Deep Dive',
		tabPlacement: 'menu',
		menuTagline: 'Protocol analytics powered by DefiLlama',
		menuTabs: [
			{
				id: 'overview',
				label: 'Overview',
				icon: 'layers',
				description: 'Volume, TVL, fees and traders across chains and versions'
			},
			{
				id: 'liquidity',
				label: 'Liquidity Depth',
				icon: 'bar-chart-2',
				description: 'TVL by version, token segment and LP custody'
			},
			{
				id: 'integrations',
				label: 'Ecosystem & Integrations',
				icon: 'globe',
				description: 'Chain share and order flow routed by aggregators'
			},
			{
				id: 'assets',
				label: 'Asset Breadth',
				icon: 'pie-chart',
				description: 'Tokens traded, new listings and RWA venues'
			},
			{
				id: 'economics',
				label: 'Economic Model',
				icon: 'banknote',
				description: 'Protocol fees by pair category and chain, UNI unlocks'
			},
			{ id: 'security', label: 'Security', icon: 'shield-check', description: 'Audit reports by firm and product' }
		],
		routePrefix: 'deep-dive'
	}
]

const BY_ENTITY_SLUG = new Map<string, MainSiteIrDashboard>(
	MAIN_SITE_IR_DASHBOARDS.map((dashboard) => [`${dashboard.entityType}:${dashboard.slug}`, dashboard])
)

/** Pass an already-normalized slug (e.g. `slug(name)`). */
export function getMainSiteIrDashboard(entityType: IrEntityType, entitySlug: string): MainSiteIrDashboard | undefined {
	return BY_ENTITY_SLUG.get(`${entityType}:${entitySlug}`)
}

export function isMainSiteIrVisible(dashboard: MainSiteIrDashboard, isLlama: boolean): boolean {
	return !dashboard.llamaOnly || isLlama
}

export function getMainSiteIrRoutePrefix(dashboard: MainSiteIrDashboard): MainSiteIrRoutePrefix {
	return dashboard.routePrefix ?? DEFAULT_MAIN_SITE_IR_ROUTE_PREFIX
}

export function getMainSiteIrBaseHref(dashboard: MainSiteIrDashboard): string {
	return `/${dashboard.entityType}/${getMainSiteIrRoutePrefix(dashboard)}/${dashboard.slug}`
}

export function getMainSiteIrTabHref(dashboard: MainSiteIrDashboard, tabId: string): string {
	const base = getMainSiteIrBaseHref(dashboard)
	if (dashboard.tabPlacement !== 'menu') return base
	return dashboard.menuTabs[0]?.id === tabId ? base : `${base}/${tabId}`
}

export type IrTabMenuItem = MainSiteIrTab & { href: string; isActive: boolean }

/** The pages listed in a menu-placed dashboard's tab menu. An item is active only while its dashboard tab is. */
export function getIrTabMenuItems(
	dashboard: Extract<MainSiteIrDashboard, { tabPlacement: 'menu' }>,
	active: boolean,
	activeTabId: string | undefined
): Array<IrTabMenuItem> {
	return dashboard.menuTabs.map((tab) => ({
		...tab,
		href: getMainSiteIrTabHref(dashboard, tab.id),
		isActive: active && activeTabId === tab.id
	}))
}

export type MainSiteIrTabResolution =
	| { type: 'tab'; tabId: string | null }
	| { type: 'redirect'; destination: string }
	| { type: 'not-found' }

export function resolveMainSiteIrTab(
	dashboard: MainSiteIrDashboard,
	tabSegment: string | undefined
): MainSiteIrTabResolution {
	if (dashboard.tabPlacement !== 'menu') {
		return tabSegment === undefined ? { type: 'tab', tabId: null } : { type: 'not-found' }
	}
	const firstTab = dashboard.menuTabs[0]
	if (!firstTab) return { type: 'not-found' }
	if (tabSegment === undefined) return { type: 'tab', tabId: firstTab.id }
	if (tabSegment === firstTab.id) return { type: 'redirect', destination: getMainSiteIrBaseHref(dashboard) }
	return dashboard.menuTabs.some((tab) => tab.id === tabSegment)
		? { type: 'tab', tabId: tabSegment }
		: { type: 'not-found' }
}

export const MAIN_SITE_IR_PROTOCOL_SLUGS = MAIN_SITE_IR_DASHBOARDS.filter(
	(dashboard) => dashboard.entityType === 'protocol'
).map((dashboard) => dashboard.slug)

export const MAIN_SITE_IR_CHAIN_SLUGS = MAIN_SITE_IR_DASHBOARDS.filter(
	(dashboard) => dashboard.entityType === 'chain'
).map((dashboard) => dashboard.slug)
