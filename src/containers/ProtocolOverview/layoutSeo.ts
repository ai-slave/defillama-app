import {
	getMainSiteIrDashboard,
	isMainSiteIrVisible,
	type MainSiteIrDashboard
} from '~/containers/Investors/mainSiteDashboards'
import { slug } from '~/utils'

export const protocolTabs = {
	information: { id: 'information', name: 'Information', route: '/protocol' },
	assets: { id: 'assets', name: 'Assets', route: '/protocol/assets' },
	tvl: { id: 'tvl', name: 'TVL', route: '/protocol/tvl' },
	rwa: { id: 'rwa', name: 'RWA', route: '/protocol/rwa' },
	borrowed: { id: 'borrowed', name: 'Active Loans', route: '/protocol/active-loans' },
	stablecoins: { id: 'stablecoins', name: 'Stablecoin Info', route: '/protocol/stablecoins' },
	bridges: { id: 'bridges', name: 'Bridge Info', route: '/protocol/bridges' },
	treasury: { id: 'treasury', name: 'Treasury', route: '/protocol/treasury' },
	unlocks: { id: 'unlocks', name: 'Unlocks', route: '/protocol/unlocks' },
	yields: { id: 'yields', name: 'Yields', route: '/protocol/yields' },
	fees: { id: 'fees', name: 'Fees and Revenue', route: '/protocol/fees' },
	dexs: { id: 'dexs', name: 'DEX Volume', route: '/protocol/dexs' },
	perps: { id: 'perps', name: 'Perp Volume', route: '/protocol/perps' },
	dexAggregators: { id: 'dexAggregators', name: 'DEX Aggregator Volume', route: '/protocol/dex-aggregators' },
	perpsAggregators: { id: 'perpsAggregators', name: 'Perp Aggregator Volume', route: '/protocol/perps-aggregators' },
	bridgeAggregators: {
		id: 'bridgeAggregators',
		name: 'Bridge Aggregator Volume',
		route: '/protocol/bridge-aggregators'
	},
	options: { id: 'options', name: 'Options Volume', route: '/protocol/options' },
	tokenRights: { id: 'tokenRights', name: 'Token Rights', route: '/protocol/token-rights' },
	forks: { id: 'forks', name: 'Forks', route: '/protocol/forks' },
	cardDetails: { id: 'cardDetails', name: 'Card Details', route: '/protocol/card-details' },
	investorRelations: { id: 'investorRelations', name: 'Investor Relations', route: '/protocol/investor-relations' }
} as const

export type ProtocolTab = keyof typeof protocolTabs

// Only these tabs are standalone pages; every other tab is noindex without a canonical.
const standaloneCanonicals: Partial<Record<ProtocolTab, string>> = {
	information: '/protocol',
	borrowed: '/protocol/active-loans',
	unlocks: '/unlocks',
	forks: '/forks'
}

const noIndexProtocolSlugs = new Set(['defi-swap'])

export function getProtocolLayoutSeo({
	name,
	isCEX,
	tab,
	seoTitle,
	seoDescription
}: {
	name: string
	isCEX?: boolean | undefined
	tab: ProtocolTab
	seoTitle?: string | undefined
	seoDescription?: string | undefined
}) {
	const entitySlug = slug(name)
	const standaloneRoute = standaloneCanonicals[tab]
	const canonicalUrl = !standaloneRoute
		? null
		: isCEX
			? `/cex/${entitySlug}`
			: tab === 'information'
				? `/protocol/${entitySlug}`
				: `${standaloneRoute}/${entitySlug}`
	return {
		title: seoTitle || `${name} Protocol Overview - DefiLlama`,
		description:
			seoDescription ||
			`Track ${name} metrics on DefiLlama. DefiLlama is committed to providing accurate data without ads or sponsored content, as well as transparency.`,
		canonicalUrl,
		noIndex: !standaloneRoute || noIndexProtocolSlugs.has(entitySlug)
	}
}

// The Active Loans tab shows loans itself, so only the other tabs explain how to add them to TVL.
export function showsActiveLoansTvlNotice(tab: ProtocolTab, category: string | null | undefined): boolean {
	return tab !== 'borrowed' && (category === 'Uncollateralized Lending' || category === 'RWA Lending')
}

export type ProtocolDashboardAnnouncement = {
	announcementId: string
	version: string
	badgeLabel: string
	href: string
	linkLabel: string
	prefix: string
	suffix: string
	className: string
	badgeClassName: string
	logoName?: string
	includeReferrer?: boolean
}

const odysseyEnterpriseDashboardAnnouncement = {
	announcementId: 'odyssey-enterprise-dashboard',
	version: '2026-06-19',
	badgeLabel: 'Odyssey Enterprise',
	href: 'https://enterprise.defillama.com/odyssey-ecosystem',
	linkLabel: 'Enterprise Dashboard',
	prefix: 'View the Odyssey',
	suffix: 'for ecosystem analytics across Odyssey, Vesper, and Metronome.',
	className:
		'border border-odyssey-announcement-border bg-(image:--odyssey-announcement-bg) text-odyssey-announcement-text shadow-odyssey-announcement',
	badgeClassName:
		'border border-announcement-chip-border bg-announcement-chip-bg text-odyssey-announcement-badge-text shadow-raised',
	logoName: 'Odyssey Finance'
} satisfies ProtocolDashboardAnnouncement

const protocolDashboardAnnouncements: Record<string, ProtocolDashboardAnnouncement> = {
	spark: {
		announcementId: 'spark-investor-relations',
		version: '2026-04-15',
		badgeLabel: 'Spark IR',
		href: 'https://investors.defillama.com/spark',
		linkLabel: 'investor relations dashboard',
		prefix: "View Spark's",
		suffix: 'for deeper analytics and investor reports.',
		className:
			'border border-spark-announcement-border bg-(image:--spark-announcement-bg) text-spark-announcement-text shadow-spark-announcement',
		badgeClassName:
			'border border-announcement-chip-border bg-announcement-chip-bg text-spark-announcement-badge-text shadow-raised',
		includeReferrer: true
	},
	vesper: odysseyEnterpriseDashboardAnnouncement,
	'odyssey-finance': odysseyEnterpriseDashboardAnnouncement,
	metronome: odysseyEnterpriseDashboardAnnouncement,
	'metronome-synth': odysseyEnterpriseDashboardAnnouncement
}

/**
 * An entity shows its own Investor Relations tab, or its parent's when the parent's dashboard is a
 * menu of pages. A visible IR tab replaces the external dashboard announcement.
 */
export function resolveProtocolDashboards({
	name,
	isCEX,
	otherProtocols,
	user
}: {
	name: string
	isCEX?: boolean | undefined
	otherProtocols?: Array<string> | null | undefined
	user: { id?: string | undefined; isLlama: boolean }
}): {
	investorRelations: MainSiteIrDashboard | null
	announcement: (ProtocolDashboardAnnouncement & { resolvedHref: string }) | null
} {
	const entitySlug = slug(name)
	const parentSlug = otherProtocols?.[0] ? slug(otherProtocols[0]) : null
	const ownIrDashboard = isCEX ? undefined : getMainSiteIrDashboard('protocol', entitySlug)
	const parentIrDashboard =
		!isCEX && !ownIrDashboard && parentSlug && parentSlug !== entitySlug
			? getMainSiteIrDashboard('protocol', parentSlug)
			: undefined
	const irDashboard = ownIrDashboard ?? (parentIrDashboard?.tabPlacement === 'menu' ? parentIrDashboard : undefined)
	if (irDashboard && isMainSiteIrVisible(irDashboard, user.isLlama)) {
		return { investorRelations: irDashboard, announcement: null }
	}
	const announcement = protocolDashboardAnnouncements[entitySlug]
	if (!announcement) return { investorRelations: null, announcement: null }
	const resolvedHref =
		announcement.includeReferrer && user.id
			? `${announcement.href}?referrer=${encodeURIComponent(user.id)}`
			: announcement.href
	return { investorRelations: null, announcement: { ...announcement, resolvedHref } }
}
