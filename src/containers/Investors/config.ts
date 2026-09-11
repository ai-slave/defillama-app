export const ALL_INVESTORS_PROJECTS = [
	{ id: 'etherfi', name: 'Ether.fi', dashboardId: '73x90j3b28pfhgx', customOnly: false },
	{ id: 'spark', name: 'Spark', dashboardId: '9vn8xp43tdzo6gt', customOnly: false },
	{ id: 'maple', name: 'Maple', dashboardId: 'l5accmh9zooc32q', customOnly: false },
	{ id: 'berachain', name: 'Berachain', dashboardId: 't62luatlj9thwx2', customOnly: true },
	{ id: 'aave', name: 'Aave', dashboardId: 'g3rswlkr9khxa03', customOnly: false },
	{ id: 'sonic', name: 'Sonic', dashboardId: 's0n1cd4shb0ard1', customOnly: true },
	{ id: 'near', name: 'NEAR', dashboardId: 'n34rr3v3nu3d4sh', customOnly: true },
	{ id: 'flare', name: 'Flare', dashboardId: 'fl4r3d4shb0ard1', customOnly: true },
	{ id: 'odyssey-ecosystem', name: 'Odyssey Ecosystem', dashboardId: '0dyss3y3c0sys7m1', customOnly: true },
	{ id: 'thorchain', name: 'THORChain', dashboardId: 'bfqwxro9m0xnc9z', customOnly: true },
	{ id: 'kpk', name: 'KPK', dashboardId: 'kpk1nv3st0rsd4s', customOnly: true },
	{ id: 'uniswap', name: 'Uniswap', dashboardId: 'un1swapd4shb0rd', customOnly: true }
] as const

export type InvestorsProject = (typeof ALL_INVESTORS_PROJECTS)[number]
export type InvestorsProjectId = InvestorsProject['id']

const INVESTORS_LIVE_PROJECT_IDS = [
	'spark',
	'sonic',
	'near',
	'thorchain',
	'flare'
] as const satisfies ReadonlyArray<InvestorsProjectId>
const INVESTORS_PREVIEW_PROJECT_IDS = ['kpk', 'uniswap'] as const satisfies ReadonlyArray<InvestorsProjectId>
const INVESTORS_COMING_SOON_PROJECT_IDS = ['kpk'] as const satisfies ReadonlyArray<InvestorsProjectId>
const INVESTORS_PREVIEW_ENABLED = process.env.NEXT_PUBLIC_INVESTORS_PREVIEW === 'true'
const INVESTORS_DOMAIN_PROJECT_IDS = [
	...INVESTORS_LIVE_PROJECT_IDS,
	...(INVESTORS_PREVIEW_ENABLED ? INVESTORS_PREVIEW_PROJECT_IDS : [])
] as const satisfies ReadonlyArray<InvestorsProjectId>
const ENTERPRISE_DOMAIN_PROJECT_IDS = ['odyssey-ecosystem'] as const satisfies ReadonlyArray<InvestorsProjectId>

export type InvestorsSiteId = 'investors' | 'enterprise'

export type InvestorsSite = Readonly<{
	id: InvestorsSiteId
	hosts: ReadonlyArray<string>
	projectIds: ReadonlyArray<InvestorsProjectId>
	landingProjectIds: ReadonlyArray<InvestorsProjectId>
	defaultProjectId: InvestorsProjectId
	comingSoonProjectIds: ReadonlyArray<InvestorsProjectId>
	umamiWebsiteId: string
}>

export const INVESTORS_SITES: Readonly<Record<InvestorsSiteId, InvestorsSite>> = {
	investors: {
		id: 'investors',
		hosts: ['investors.defillama.com'],
		projectIds: INVESTORS_DOMAIN_PROJECT_IDS,
		landingProjectIds: INVESTORS_LIVE_PROJECT_IDS,
		defaultProjectId: 'spark',
		comingSoonProjectIds: INVESTORS_COMING_SOON_PROJECT_IDS,
		umamiWebsiteId: '11de15eb-61d0-41c5-9e73-0bf496cc653c'
	},
	enterprise: {
		id: 'enterprise',
		hosts: ['enterprise.defillama.com'],
		projectIds: ENTERPRISE_DOMAIN_PROJECT_IDS,
		landingProjectIds: [...INVESTORS_LIVE_PROJECT_IDS, ...ENTERPRISE_DOMAIN_PROJECT_IDS],
		defaultProjectId: 'odyssey-ecosystem',
		comingSoonProjectIds: [],
		umamiWebsiteId: '1c194e22-d31d-4816-b803-8074419f1b3e'
	}
}

export const ALL_INVESTORS_PROTOCOL_IDS: ReadonlyArray<string> = ALL_INVESTORS_PROJECTS.map((p) => p.id)

function normalizeHost(host: string | null | undefined): string | undefined {
	// Only accept a hostname with an optional numeric port, not a URL or forwarded-host list.
	return host?.match(/^([a-z0-9.-]+)(?::[0-9]+)?$/i)?.[1].toLowerCase()
}

/** Resolve a public/browser hostname independently of deployment configuration. */
export function getInvestorsSite(host: string | null | undefined): InvestorsSite | null {
	const hostname = normalizeHost(host)
	if (!hostname) return null

	for (const site of Object.values(INVESTORS_SITES)) {
		if (site.hosts.includes(hostname)) return site
		if (process.env.NODE_ENV === 'development' && hostname === `${site.id}.localhost`) return site
	}
	return null
}

/**
 * The load balancer uses a technical Host for Coolify routing and overwrites
 * X-Forwarded-Host with the public domain. That header must be preserved by
 * subsequent proxies. Direct public hosts take precedence over forwarded input.
 */
export function getInvestorsSiteForRequest(
	host: string | null | undefined,
	forwardedHost: string | Array<string> | null | undefined
): InvestorsSite | null {
	const hostname = normalizeHost(host)
	if (!hostname) return null
	const directSite = getInvestorsSite(hostname)
	if (directSite || hostname === 'defillama.com' || hostname === 'www.defillama.com') return directSite
	return typeof forwardedHost === 'string' ? getInvestorsSite(forwardedHost) : null
}

export function getInvestorsProjects(projectIds: ReadonlyArray<InvestorsProjectId>): Array<InvestorsProject> {
	return projectIds
		.map((projectId) => ALL_INVESTORS_PROJECTS.find((project) => project.id === projectId))
		.filter((project): project is InvestorsProject => !!project)
}

export function getInvestorsProject(site: InvestorsSite, protocol: string): InvestorsProject | undefined {
	if (!site.projectIds.some((projectId) => projectId === protocol)) return undefined
	return ALL_INVESTORS_PROJECTS.find((project) => project.id === protocol)
}

export function getInvestorsLandingProjectHref(site: InvestorsSite, projectId: InvestorsProjectId): string {
	if (site.projectIds.includes(projectId)) return `/${projectId}`

	const destination = Object.values(INVESTORS_SITES).find((candidate) => candidate.projectIds.includes(projectId))
	return destination ? `https://${destination.hosts[0]}/${projectId}` : `/${projectId}`
}
