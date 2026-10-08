import { formatNumber, formatPercent, formatUsd } from '~/utils/numberFormat'
import type { RwaNamedBar } from '../../cards/cardData'
import type { RWAPlatformFounder, RWAPlatformMeta, RWAPlatformRevenueConfidence } from '../api.types'

/* Every fold the five panels render, and the predicates that say when a panel has one line to say. No React here. */

export function getRwaPlatformTags(meta: RWAPlatformMeta): Array<string> {
	const tags: Array<string> = []
	for (const tag of [
		...(meta.platformType ?? []),
		...(meta.category ?? []),
		...(meta.accessModel ? [meta.accessModel] : [])
	]) {
		if (!tags.includes(tag)) tags.push(tag)
	}
	return tags
}

export type RWAPlatformSocial = {
	label: string
	href: string
	icon: 'twitter' | 'linkedin' | 'discord' | 'telegram' | 'github'
}

const SOCIALS: ReadonlyArray<{ key: keyof RWAPlatformMeta; label: string; icon: RWAPlatformSocial['icon'] }> = [
	{ key: 'twitter', label: 'Twitter', icon: 'twitter' },
	{ key: 'linkedin', label: 'LinkedIn', icon: 'linkedin' },
	{ key: 'discord', label: 'Discord', icon: 'discord' },
	{ key: 'telegram', label: 'Telegram', icon: 'telegram' },
	{ key: 'rwaGithub', label: 'GitHub', icon: 'github' }
]

export type RWAPlatformLinks = {
	/** The referral links when the index has them, the official site otherwise. */
	websites: Array<string>
	docs: string | null
	protocolHref: string | null
	socials: Array<RWAPlatformSocial>
}

export function getRwaPlatformLinks(meta: RWAPlatformMeta): RWAPlatformLinks {
	const socials: Array<RWAPlatformSocial> = []
	for (const social of SOCIALS) {
		const href = meta[social.key]
		if (typeof href === 'string' && href.length > 0) socials.push({ label: social.label, href, icon: social.icon })
	}
	return {
		websites: meta.refLinks?.length ? meta.refLinks : (meta.website ?? []),
		docs: meta.docs ?? null,
		protocolHref: meta.protocolSlug ? `/protocol/${meta.protocolSlug}` : null,
		socials
	}
}

export const RWA_ISSUER_PILLS = 5

/** The issuers on the platform when there is more than one, the largest by active AUM first. */
export function rankRwaPlatformIssuers(issuers: Array<RwaNamedBar>): { shown: Array<string>; more: number } {
	if (issuers.length < 2) return { shown: [], more: 0 }
	const ranked = [...issuers].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
	return {
		shown: ranked.slice(0, RWA_ISSUER_PILLS).map((issuer) => issuer.name),
		more: ranked.length - RWA_ISSUER_PILLS
	}
}

/** A link to another DefiLlama page in About's links row: a platform's venue page, a venue's platform page. */
export type RWAAboutCrossLink = { label: string; href: string }

/** About draws only when it has one thing to say: a profile with only a name would be an empty box. */
export function hasRwaAboutContent(
	meta: RWAPlatformMeta,
	issuers: Array<RwaNamedBar>,
	crossLink: RWAAboutCrossLink | null
): boolean {
	const links = getRwaPlatformLinks(meta)
	return (
		!!meta.description ||
		getRwaPlatformTags(meta).length > 0 ||
		links.websites.length > 0 ||
		links.docs != null ||
		links.protocolHref != null ||
		links.socials.length > 0 ||
		crossLink != null ||
		rankRwaPlatformIssuers(issuers).shown.length > 0
	)
}

export type RWAPanelRow = { label: string; value: string; mono: boolean }

function bps(value: number): string {
	return `${formatNumber(value)} bps`
}

function pct(value: number): string {
	return formatPercent(value, { input: 'percent' })
}

export function getRwaFeeRows(meta: RWAPlatformMeta): Array<RWAPanelRow> {
	const rows: Array<RWAPanelRow> = []
	const push = (label: string, value: string | null | undefined, mono = true) => {
		if (value != null) rows.push({ label, value, mono })
	}
	push(
		'Est. annual revenue',
		meta.estAnnualRevenueUsd == null
			? null
			: formatUsd(meta.estAnnualRevenueUsd, {
					compact: true,
					minimumCompactValue: 1_000_000,
					compactSuffix: 'lowercase'
				})
	)
	push('Holder total fee', meta.holderTotalFeeBps == null ? null : bps(meta.holderTotalFeeBps))
	push('Asset manager take', meta.assetManagerTakeBps == null ? null : bps(meta.assetManagerTakeBps))
	push(
		'Tokenization platform take',
		meta.tokenizationPlatformTakeBps == null ? null : bps(meta.tokenizationPlatformTakeBps)
	)
	push('Performance fee', meta.performanceFeePct == null ? null : pct(meta.performanceFeePct))
	push('Yield spread retained', meta.yieldSpreadRetainedBps == null ? null : bps(meta.yieldSpreadRetainedBps))
	push('Mint fee', meta.mintFeeBps == null ? null : bps(meta.mintFeeBps))
	push('Redemption fee', meta.redemptionFeeBps == null ? null : bps(meta.redemptionFeeBps))
	push('Underlying fund expense', meta.underlyingFundExpenseBps == null ? null : bps(meta.underlyingFundExpenseBps))
	push('Platform setup fee', meta.platformSetupFeeUsd == null ? null : formatUsd(meta.platformSetupFeeUsd))
	push(
		'Recurring service fee',
		meta.platformRecurringServiceFeeUsdPerYr == null
			? null
			: `${formatUsd(meta.platformRecurringServiceFeeUsdPerYr)}/yr`
	)
	push('Perp maker fee', meta.perpMakerFeeBps == null ? null : bps(meta.perpMakerFeeBps))
	push('Perp taker fee', meta.perpTakerFeeBps == null ? null : bps(meta.perpTakerFeeBps))
	push('Perp funding retention', meta.perpFundingRetentionPct == null ? null : pct(meta.perpFundingRetentionPct))
	push('Float income', meta.floatIncome == null ? null : meta.floatIncome ? 'Yes' : 'No', false)
	push(
		'Margin settlement assets',
		meta.marginSettlementAsset?.length ? meta.marginSettlementAsset.join(', ') : null,
		false
	)
	push('Fees last verified', meta.feeLastVerified)
	push('Fee waiver ends', meta.feeWaiverEndDate)
	return rows
}

/** The six run-in fields behind the estimate; a toggle in the panel, not rows. */
export function getRwaRevenueDetails(meta: RWAPlatformMeta): Array<{ label: string; text: string }> {
	const details: Array<{ label: string; text: string }> = []
	const push = (label: string, text: string | null) => {
		if (text) details.push({ label, text })
	}
	push('Take-rate basis', meta.takeRateBasis)
	push('Revenue mix', meta.revenueMix)
	push('Verification method', meta.revenueVerificationMethod)
	push('Chain and share-class variants', meta.chainShareClassFeeVariants)
	push('Subsidies or rebates', meta.subsidyRebateArrangements)
	return details
}

export type RWALinkGroup = { label: string; urls: Array<string> }

function linkGroups(entries: ReadonlyArray<readonly [string, Array<string> | null]>): Array<RWALinkGroup> {
	const groups: Array<RWALinkGroup> = []
	for (const [label, urls] of entries) {
		if (urls && urls.length > 0) groups.push({ label, urls })
	}
	return groups
}

export function getRwaDocumentGroups(meta: RWAPlatformMeta): Array<RWALinkGroup> {
	return linkGroups([
		['Prospectus', meta.prospectusUrl],
		['Fee schedule', meta.feeScheduleUrl],
		['Terms and conditions', meta.tcsUrl],
		['Governance whitepaper', meta.governanceWhitepaperUrl],
		['Issuer document', meta.issuerDocsUrl]
	])
}

/** The proof links the Compliance panel shows. */
export function getRwaProofGroups(meta: RWAPlatformMeta): Array<RWALinkGroup> {
	return linkGroups([
		['Attestation report', meta.attestationLinks],
		['Oracle proof', meta.oracleProofLink]
	])
}

/** The source link the Regulation panel shows. */
export function getRwaSourceGroups(meta: RWAPlatformMeta): Array<RWALinkGroup> {
	return linkGroups([['Issuer source', meta.issuerSourceLink]])
}

const CONFIDENCE_TONE: Record<RWAPlatformRevenueConfidence, string> = {
	'Public Filings': 'text-data-up',
	'Issuer-Disclosed': 'text-data-up-alt',
	'Reasoned Estimate': 'text-warning',
	'No-public-data': 'text-tertiary'
}

export function getRwaConfidenceTone(confidence: RWAPlatformRevenueConfidence): string {
	return CONFIDENCE_TONE[confidence]
}

export function hasRwaFeesContent(meta: RWAPlatformMeta): boolean {
	return (
		meta.revenueModel != null ||
		getRwaFeeRows(meta).length > 0 ||
		meta.revenueConfidence != null ||
		meta.revenueNotes != null ||
		getRwaRevenueDetails(meta).length > 0 ||
		getRwaDocumentGroups(meta).length > 0
	)
}

export type RWAAccessSplit = {
	permissionless: number
	permissioned: number
	total: number
	permissionlessPct: number | null
}

/** Permissionless against the rest; the rest is permissioned, custodial or unknown. */
export function getRwaAccessSplit({
	permissionlessCount,
	assetCount
}: {
	permissionlessCount: number
	assetCount: number
}): RWAAccessSplit {
	return {
		permissionless: permissionlessCount,
		permissioned: assetCount - permissionlessCount,
		total: assetCount,
		permissionlessPct: assetCount > 0 ? (permissionlessCount / assetCount) * 100 : null
	}
}

export function getRwaRegulationFacts(meta: RWAPlatformMeta): Array<{ label: string; value: string }> {
	const facts: Array<{ label: string; value: string }> = []
	if (meta.issuer) facts.push({ label: 'Legal entity', value: meta.issuer })
	if (meta.headquarters) facts.push({ label: 'Headquarters', value: meta.headquarters })
	if (meta.foundedYear != null) facts.push({ label: 'Founded', value: String(meta.foundedYear) })
	if (meta.primaryChain) facts.push({ label: 'Primary chain', value: meta.primaryChain })
	return facts
}

export function getRwaLeadership(meta: RWAPlatformMeta): Array<RWAPlatformFounder> {
	if (meta.foundersParsed.length > 0) return meta.foundersParsed
	return meta.founders ? [{ name: meta.founders, role: null }] : []
}

/** The Entity panel: the facts, the leadership, the structure and registry prose, the source link. */
export function hasRwaEntityContent(meta: RWAPlatformMeta): boolean {
	return (
		getRwaRegulationFacts(meta).length > 0 ||
		getRwaLeadership(meta).length > 0 ||
		meta.entityStructureNotes != null ||
		meta.issuerRegistryInfo != null ||
		(meta.issuerSourceLink?.length ?? 0) > 0
	)
}

export function hasRwaMilestones(meta: RWAPlatformMeta): boolean {
	return meta.milestones.length > 0 || meta.keyMilestones != null
}
