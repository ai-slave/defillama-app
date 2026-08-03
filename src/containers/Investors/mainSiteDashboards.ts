import type { InvestorsProjectId } from './config'

/**
 * Main-site (defillama.com) surfacing of Investor Relations dashboards.
 *
 * This is intentionally independent of `config.ts` / `isInvestorsEnabled()`, which are gated to the
 * investors.defillama.com / enterprise.defillama.com deployments and resolve to empty on the main build.
 * The dashboard modules themselves are loaded through the ungated `registry.ts` by `dashboardId`.
 *
 * Add a row here to surface another entity once its dashboard is ready.
 */

export type IrEntityType = 'protocol' | 'chain'

export interface MainSiteIrDashboard {
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
}

export const MAIN_SITE_IR_DASHBOARDS: MainSiteIrDashboard[] = [
	{
		irProjectId: 'spark',
		dashboardId: '9vn8xp43tdzo6gt',
		entityType: 'protocol',
		slug: 'spark',
		entityName: 'Spark',
		customOnly: false,
		brandGradient: 'linear-gradient(90deg, #FA43BD, #FFA930)',
		tabLabel: 'Investor Relations'
	},
	{
		irProjectId: 'near',
		dashboardId: 'n34rr3v3nu3d4sh',
		entityType: 'chain',
		slug: 'near',
		entityName: 'NEAR',
		customOnly: true,
		brandGradient: 'linear-gradient(90deg, #00C1DE, #00E4AA, #00EC97)',
		tabLabel: 'Investor Relations'
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
		tabLabel: 'Investor Relations'
	},
	{
		irProjectId: 'sonic',
		dashboardId: 's0n1cd4shb0ard1',
		entityType: 'chain',
		slug: 'sonic',
		entityName: 'Sonic',
		customOnly: true,
		brandGradient: 'linear-gradient(90deg, #fac461, #fe7d2d, #e3570a)',
		tabLabel: 'Investor Relations'
	},
	{
		irProjectId: 'thorchain',
		dashboardId: 'bfqwxro9m0xnc9z',
		entityType: 'chain',
		slug: 'thorchain',
		entityName: 'THORChain',
		customOnly: true,
		brandGradient: 'linear-gradient(90deg, #00CCFF, #31FD9D)',
		tabLabel: 'Investor Relations'
	},
	{
		irProjectId: 'thorchain',
		dashboardId: 'bfqwxro9m0xnc9z',
		entityType: 'protocol',
		slug: 'thorchain',
		entityName: 'THORChain',
		customOnly: true,
		brandGradient: 'linear-gradient(90deg, #00CCFF, #31FD9D)',
		tabLabel: 'Investor Relations'
	},
	{
		irProjectId: 'odyssey-ecosystem',
		dashboardId: '0dyss3y3c0sys7m1',
		entityType: 'protocol',
		slug: 'odyssey-finance',
		entityName: 'Odyssey Ecosystem',
		customOnly: true,
		brandGradient: 'linear-gradient(90deg, #3b82f6, #60a5fa, #93c5fd)',
		tabLabel: 'Enterprise Dashboard'
	}
]

const BY_ENTITY_SLUG = new Map<string, MainSiteIrDashboard>(
	MAIN_SITE_IR_DASHBOARDS.map((dashboard) => [`${dashboard.entityType}:${dashboard.slug}`, dashboard])
)

/** Pass an already-normalized slug (e.g. `slug(name)`). */
export function getMainSiteIrDashboard(entityType: IrEntityType, entitySlug: string): MainSiteIrDashboard | undefined {
	return BY_ENTITY_SLUG.get(`${entityType}:${entitySlug}`)
}

/** Pass an already-normalized slug (e.g. `slug(name)`). */
export function hasMainSiteIrDashboard(entityType: IrEntityType, entitySlug: string): boolean {
	return BY_ENTITY_SLUG.has(`${entityType}:${entitySlug}`)
}

export const MAIN_SITE_IR_PROTOCOL_SLUGS = MAIN_SITE_IR_DASHBOARDS.filter(
	(dashboard) => dashboard.entityType === 'protocol'
).map((dashboard) => dashboard.slug)

export const MAIN_SITE_IR_CHAIN_SLUGS = MAIN_SITE_IR_DASHBOARDS.filter(
	(dashboard) => dashboard.entityType === 'chain'
).map((dashboard) => dashboard.slug)
