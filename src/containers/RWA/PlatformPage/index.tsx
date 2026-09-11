import { useRouter } from 'next/router'
import { useState } from 'react'
import { ExternalLinkButton } from '~/components/ExternalLinkButton'
import { BasicLink } from '~/components/Link'
import { Menu } from '~/components/Menu'
import { TokenLogo } from '~/components/TokenLogo'
import { buttonStyles } from '~/ui/Button'
import { Icon, type IIcon } from '~/ui/Icon'
import { KeyMetricsHeader } from '~/ui/KeyMetricsCard'
import { MetricRow } from '~/ui/MetricPrimitives'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { StatItem, SummaryStatsCard } from '~/ui/SummaryStats'
import { Tabs, TabPanel } from '~/ui/Tabs'
import { Tooltip } from '~/ui/Tooltip'
import { formatCompactNumber, formatNumber, formatPercent, formatUsd } from '~/utils/numberFormat'
import { pushShallowQuery, readSingleQueryValue } from '~/utils/routerQuery'
import type { RWAPlatformMeta } from './api.types'
import { PeerRanking } from './PeerRanking'
import type { RWAPlatformMixRow, RWAPlatformPageData } from './types'

const compactUsdOptions = {
	compact: true,
	minimumCompactValue: 1_000_000,
	compactSuffix: 'lowercase'
} as const

const linkButtonStyles = buttonStyles({ variant: 'secondary', size: 'md' })
const iconLinkStyles = buttonStyles({ variant: 'secondary', size: 'md', square: true })

/** Prose longer than this gets a Show more/less toggle. Character-based on
    purpose: measuring rendered overflow needs a layout effect per paragraph,
    and that measure-then-setState loop is what we removed from FormattedName. */
const PROSE_CLAMP_THRESHOLD = 320

function formatBps(value: number): string {
	return `${formatNumber(value)} bps`
}

/** Long prose at a readable measure, clamped until the reader asks for the rest. */
function Prose({ children }: { children: string }) {
	const [expanded, setExpanded] = useState(false)
	const needsToggle = children.length > PROSE_CLAMP_THRESHOLD

	return (
		<div className="flex max-w-[70ch] flex-col items-start gap-1">
			<p className={`${expanded || !needsToggle ? '' : 'line-clamp-4 '}body-md text-secondary`}>{children}</p>
			{needsToggle ? (
				<button
					type="button"
					onClick={() => setExpanded((previous) => !previous)}
					className="label-sm text-link hover:underline"
				>
					{expanded ? 'Show less' : 'Show more'}
				</button>
			) : null}
		</div>
	)
}

/** Expandable detail group, initially open so its information is visible. */
function Disclosure({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<details open className="group/disclosure flex flex-col border-t border-subtle py-2">
			<summary className="flex cursor-pointer items-center gap-1 label-md text-secondary hover:text-primary">
				{title}
				<Icon
					name="chevron-down"
					className="size-4 text-tertiary transition-transform duration-100 group-open/disclosure:rotate-180"
				/>
			</summary>
			<div className="flex flex-col gap-4 pt-3">{children}</div>
		</details>
	)
}

/** Methodology-style run-in: secondary medium label, primary sentence body. */
function RunInText({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<p className="max-w-[70ch] body-md">
			<span className="font-medium text-secondary">{label}:</span> {value}
		</p>
	)
}

/** Stacked pair: tertiary label over a medium value. */
function ProfileField({ label, value, wide }: { label: string; value: React.ReactNode; wide?: boolean }) {
	return (
		<div className={`flex flex-col gap-0.5${wide ? ' col-span-full' : ''}`}>
			<dt className="body-sm text-tertiary">{label}</dt>
			<dd className="label-md">{value}</dd>
		</div>
	)
}

function FactGrid({ children }: { children: React.ReactNode }) {
	return <dl className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</dl>
}

/** One column of the information view: a heading over its own content. */
function InfoGroup({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<section className="flex flex-col gap-3">
			<h2 className="heading-xs">{title}</h2>
			{children}
		</section>
	)
}

const SOCIAL_LINKS: Array<{ key: keyof RWAPlatformMeta; label: string; icon: IIcon['name'] }> = [
	{ key: 'twitter', label: 'Twitter', icon: 'twitter' },
	{ key: 'linkedin', label: 'LinkedIn', icon: 'linkedin' },
	{ key: 'discord', label: 'Discord', icon: 'discord' },
	{ key: 'telegram', label: 'Telegram', icon: 'telegram' },
	{ key: 'rwaGithub', label: 'GitHub', icon: 'github' }
]

function LinkRow({ meta }: { meta: RWAPlatformMeta }) {
	const socials = SOCIAL_LINKS.flatMap((link) => {
		const href = meta[link.key]
		return typeof href === 'string' && href.length > 0 ? [{ ...link, href }] : []
	})
	// The upstream Ref Links field contains referral destinations for the primary CTA.
	const websiteLinks = meta.refLinks?.length ? meta.refLinks : meta.website
	const hasPrimary = (websiteLinks?.length ?? 0) > 0 || meta.docs != null || meta.protocolSlug != null
	if (!hasPrimary && socials.length === 0) return null

	return (
		<div className="flex flex-wrap items-center gap-1.5">
			{websiteLinks ? (
				websiteLinks.length > 1 ? (
					<Menu name="Website" options={websiteLinks} isExternal className={linkButtonStyles} />
				) : (
					<ExternalLinkButton href={websiteLinks[0]} icon="globe">
						Website
					</ExternalLinkButton>
				)
			) : null}
			{meta.docs ? (
				<ExternalLinkButton href={meta.docs} icon="file-text">
					Docs
				</ExternalLinkButton>
			) : null}
			{meta.protocolSlug ? (
				<BasicLink href={`/protocol/${meta.protocolSlug}`} className={linkButtonStyles}>
					<span>Protocol page</span>
				</BasicLink>
			) : null}
			{socials.length > 0 ? <span className="mx-1 h-6 w-px bg-surface-elevated-2" aria-hidden="true" /> : null}
			{socials.map((social) => (
				<Tooltip
					key={social.label}
					content={social.label}
					render={<a href={social.href} target="_blank" rel="noopener noreferrer" className={iconLinkStyles} />}
				>
					<Icon name={social.icon} className="size-3.5" />
					<span className="sr-only">{social.label}</span>
				</Tooltip>
			))}
		</div>
	)
}

/** External document pills, grouped by kind (several prospectuses collapse into a menu). */
function DocumentLinks({ groups }: { groups: Array<{ label: string; urls: Array<string> }> }) {
	if (groups.length === 0) return null
	return (
		<div className="flex flex-wrap gap-1.5">
			{groups.map((group) =>
				group.urls.length > 1 ? (
					<Menu key={group.label} name={group.label} options={group.urls} isExternal className={linkButtonStyles} />
				) : (
					<ExternalLinkButton key={group.label} href={group.urls[0]} icon="file-text">
						{group.label}
					</ExternalLinkButton>
				)
			)}
		</div>
	)
}

function collectLinkGroups(entries: ReadonlyArray<readonly [string, Array<string> | null]>) {
	const groups: Array<{ label: string; urls: Array<string> }> = []
	for (const [label, urls] of entries) {
		if (urls && urls.length > 0) groups.push({ label, urls })
	}
	return groups
}

/* ---------------------------------------------------------------------------
   Identity card — the platform's own numbers, sat next to the chart in the
   summary grid (same shape as the protocol page's key-metrics card).
--------------------------------------------------------------------------- */

/** A total computed over the assets currently listed, not platform metadata. */
export type RWAPlatformListedTotal = {
	label: string
	tooltip?: React.ReactNode
	value: React.ReactNode
}

export function RWAPlatformHeader({
	data,
	includeBridgeTvl,
	listedTotals
}: {
	data: RWAPlatformPageData
	includeBridgeTvl: boolean
	/** Filter-dependent aggregates, shown as their own group under Key Metrics. */
	listedTotals: Array<RWAPlatformListedTotal>
}) {
	const { meta } = data
	const displayedDefiActiveTvl = includeBridgeTvl ? data.defiActiveTvl : data.defiActiveTvl - data.bridgeTvl
	const displayedDefiActiveTvlToAumPct = meta.onchainAum > 0 ? (displayedDefiActiveTvl / meta.onchainAum) * 100 : null

	return (
		<SummaryStatsCard padding="sm">
			<div className="flex flex-col gap-2">
				<h1 className="flex flex-wrap items-center gap-2 heading-sm">
					{meta.logo ? <TokenLogo src={meta.logo} size={24} alt={`${meta.name} logo`} /> : null}
					<span>{meta.name}</span>
					{meta.suspicious === true ? (
						<span className="flex items-center gap-1 rounded-full bg-surface-elevated-2 px-2 py-0.5 label-sm text-data-down">
							<Icon name="alert-triangle" className="size-3.5" />
							Suspicious
						</span>
					) : null}
				</h1>
				{meta.suspicious === true && meta.suspiciousReason ? (
					<p className="flex items-start gap-1.5 body-sm text-data-down">
						<Icon name="alert-triangle" className="mt-0.5 size-3.5 shrink-0" />
						{meta.suspiciousReason}
					</p>
				) : null}
			</div>
			<StatItem label="On-chain AUM" value={formatUsd(meta.onchainAum, compactUsdOptions)} />
			{/* Two groups, two scopes: the platform's own numbers, then the same
			    kinds of number recomputed over whatever the filters currently
			    select. Naming both scopes is what keeps "DeFi TVL" and "DeFi
			    Active TVL" from reading as two answers to one question. */}
			<div className="flex flex-col gap-2">
				<KeyMetricsHeader title="Platform totals" />
				<div className="flex flex-col">
					<MetricRow label="Live assets" value={formatCompactNumber(data.assetCount)} />
					<MetricRow label="Chains" value={formatCompactNumber(data.chainCount)} />
					{meta.estAnnualRevenueUsd != null ? (
						<MetricRow label="Est. annual revenue" value={formatUsd(meta.estAnnualRevenueUsd, compactUsdOptions)} />
					) : null}
					<MetricRow label="DeFi TVL" value={formatUsd(displayedDefiActiveTvl, compactUsdOptions)} />
					{displayedDefiActiveTvlToAumPct != null ? (
						<MetricRow
							label="DeFi TVL / AUM"
							value={formatPercent(displayedDefiActiveTvlToAumPct, {
								input: 'percent'
							})}
						/>
					) : null}
					{data.assetCount > 0 ? (
						<MetricRow label="Confirmed attestations" value={`${data.attestedAssetCount} / ${data.assetCount}`} />
					) : null}
					{data.dominantAccessModel ? (
						<MetricRow
							label="Primary access"
							value={`${data.dominantAccessModel.name} (${data.dominantAccessModel.count})`}
							valueClassName="ml-auto label-md"
						/>
					) : null}
				</div>
			</div>
			{listedTotals.length > 0 ? (
				<div className="flex flex-col gap-2">
					<KeyMetricsHeader title="Totals for filtered assets" />
					<div className="flex flex-col">
						{listedTotals.map((total) => (
							<MetricRow
								key={total.label}
								label={total.label}
								{...(total.tooltip != null ? { tooltip: total.tooltip } : {})}
								value={total.value}
							/>
						))}
					</div>
				</div>
			) : null}
		</SummaryStatsCard>
	)
}

/* ---------------------------------------------------------------------------
   Asset mix view.
--------------------------------------------------------------------------- */

/* Every row is rendered: the mix owns a full panel now, and a truncated list
   with a "+12 more" count the reader cannot open is a dead end. */
function MixList({ rows }: { rows: Array<RWAPlatformMixRow> }) {
	const maxCount = rows[0]?.count ?? 0
	return (
		<div className="flex flex-col gap-1.5">
			{rows.map((row) => (
				<div key={row.name} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-x-3">
					<span className="truncate body-md" title={row.name}>
						{row.name}
					</span>
					<span className="h-1.5 overflow-hidden rounded-full bg-surface-elevated-1">
						<span
							className="block h-full rounded-full bg-brand"
							style={{
								width: `${maxCount > 0 ? (row.count / maxCount) * 100 : 0}%`
							}}
						/>
					</span>
					<span className="mono-sm text-secondary">{formatCompactNumber(row.count)}</span>
				</div>
			))}
		</div>
	)
}

function AssetMix({ data }: { data: RWAPlatformPageData }) {
	return (
		<Panel padding="none">
			<PanelHeader>
				<PanelTitle>Asset mix</PanelTitle>
			</PanelHeader>
			<div className="grid grid-cols-1 gap-6 p-4 md:grid-cols-2 xl:grid-cols-3">
				{data.categoryMix.length > 0 ? (
					<InfoGroup title="Categories">
						<MixList rows={data.categoryMix} />
					</InfoGroup>
				) : null}
				{data.assetClassMix.length > 0 ? (
					<InfoGroup title="Asset classes">
						<MixList rows={data.assetClassMix} />
					</InfoGroup>
				) : null}
				{data.chainMix.length > 0 ? (
					<InfoGroup title="Chain deployments">
						<MixList rows={data.chainMix} />
					</InfoGroup>
				) : null}
			</div>
		</Panel>
	)
}

/* ---------------------------------------------------------------------------
   Information view — the reading surface: what the platform is, how it earns,
   who is behind it. Always mounted (see RWAPlatformDataViews) so the profile
   copy stays in the served HTML.
--------------------------------------------------------------------------- */

function Overview({ meta }: { meta: RWAPlatformMeta }) {
	const tags = Array.from(
		new Set([...(meta.platformType ?? []), ...(meta.category ?? []), ...(meta.accessModel ? [meta.accessModel] : [])])
	)
	if (meta.description == null && tags.length === 0) return null

	return (
		<div className="flex flex-col gap-3">
			{meta.description ? <Prose>{meta.description}</Prose> : null}
			{tags.length > 0 ? (
				<div className="flex flex-wrap gap-1.5">
					{tags.map((tag) => (
						<span key={tag} className="rounded-full bg-surface-elevated-2 px-2 py-0.5 label-sm text-secondary">
							{tag}
						</span>
					))}
				</div>
			) : null}
		</div>
	)
}

function hasProfileFacts(meta: RWAPlatformMeta): boolean {
	return (
		meta.foundedYear != null ||
		meta.headquarters != null ||
		meta.primaryChain != null ||
		meta.parentPlatform != null ||
		meta.issuer != null ||
		meta.oracleProvider != null
	)
}

function ProfileFacts({ meta }: { meta: RWAPlatformMeta }) {
	return (
		<InfoGroup title="Profile">
			<FactGrid>
				{meta.foundedYear != null ? <ProfileField label="Founded" value={meta.foundedYear} /> : null}
				{meta.headquarters ? <ProfileField label="Headquarters" value={meta.headquarters} /> : null}
				{meta.primaryChain ? <ProfileField label="Primary chain" value={meta.primaryChain} /> : null}
				{meta.parentPlatform ? <ProfileField label="Parent platform" value={meta.parentPlatform} /> : null}
				{meta.issuer ? <ProfileField label="Issuer" value={meta.issuer} wide /> : null}
				{meta.oracleProvider ? <ProfileField label="Oracle" value={meta.oracleProvider} wide /> : null}
			</FactGrid>
		</InfoGroup>
	)
}

function hasEconomics(meta: RWAPlatformMeta): boolean {
	return (
		meta.holderTotalFeeBps != null ||
		meta.assetManagerTakeBps != null ||
		meta.tokenizationPlatformTakeBps != null ||
		meta.performanceFeePct != null ||
		meta.yieldSpreadRetainedBps != null ||
		meta.mintFeeBps != null ||
		meta.redemptionFeeBps != null ||
		meta.underlyingFundExpenseBps != null ||
		meta.floatIncome != null ||
		meta.platformSetupFeeUsd != null ||
		meta.platformRecurringServiceFeeUsdPerYr != null ||
		meta.perpMakerFeeBps != null ||
		meta.perpTakerFeeBps != null ||
		meta.perpFundingRetentionPct != null ||
		meta.revenueConfidence != null ||
		meta.feeLastVerified != null ||
		meta.feeWaiverEndDate != null ||
		(meta.marginSettlementAsset?.length ?? 0) > 0
	)
}

function Economics({ meta }: { meta: RWAPlatformMeta }) {
	return (
		<InfoGroup title="Economics & revenue">
			<div className="flex flex-col">
				{meta.holderTotalFeeBps != null ? (
					<MetricRow label="Holder total fee" value={formatBps(meta.holderTotalFeeBps)} />
				) : null}
				{meta.assetManagerTakeBps != null ? (
					<MetricRow label="Asset manager take" value={formatBps(meta.assetManagerTakeBps)} />
				) : null}
				{meta.tokenizationPlatformTakeBps != null ? (
					<MetricRow label="Tokenization platform take" value={formatBps(meta.tokenizationPlatformTakeBps)} />
				) : null}
				{meta.performanceFeePct != null ? (
					<MetricRow label="Performance fee" value={formatPercent(meta.performanceFeePct, { input: 'percent' })} />
				) : null}
				{meta.yieldSpreadRetainedBps != null ? (
					<MetricRow label="Yield spread retained" value={formatBps(meta.yieldSpreadRetainedBps)} />
				) : null}
				{meta.mintFeeBps != null ? <MetricRow label="Mint fee" value={formatBps(meta.mintFeeBps)} /> : null}
				{meta.redemptionFeeBps != null ? (
					<MetricRow label="Redemption fee" value={formatBps(meta.redemptionFeeBps)} />
				) : null}
				{meta.underlyingFundExpenseBps != null ? (
					<MetricRow label="Underlying fund expense" value={formatBps(meta.underlyingFundExpenseBps)} />
				) : null}
				{meta.platformSetupFeeUsd != null ? (
					<MetricRow label="Platform setup fee" value={formatUsd(meta.platformSetupFeeUsd)} />
				) : null}
				{meta.platformRecurringServiceFeeUsdPerYr != null ? (
					<MetricRow
						label="Recurring service fee"
						value={`${formatUsd(meta.platformRecurringServiceFeeUsdPerYr)}/yr`}
					/>
				) : null}
				{meta.perpMakerFeeBps != null ? (
					<MetricRow label="Perp maker fee" value={formatBps(meta.perpMakerFeeBps)} />
				) : null}
				{meta.perpTakerFeeBps != null ? (
					<MetricRow label="Perp taker fee" value={formatBps(meta.perpTakerFeeBps)} />
				) : null}
				{meta.perpFundingRetentionPct != null ? (
					<MetricRow
						label="Perp funding retention"
						value={formatPercent(meta.perpFundingRetentionPct, {
							input: 'percent'
						})}
					/>
				) : null}
				{meta.floatIncome != null ? (
					<MetricRow label="Float income" value={meta.floatIncome ? 'Yes' : 'No'} valueClassName="ml-auto label-md" />
				) : null}
				{meta.marginSettlementAsset && meta.marginSettlementAsset.length > 0 ? (
					<MetricRow
						label="Margin settlement assets"
						value={meta.marginSettlementAsset.join(', ')}
						valueClassName="ml-auto label-md"
					/>
				) : null}
				{meta.revenueConfidence ? (
					<MetricRow label="Revenue confidence" value={meta.revenueConfidence} valueClassName="ml-auto label-md" />
				) : null}
				{meta.feeLastVerified ? (
					<MetricRow label="Fees last verified" value={meta.feeLastVerified} valueClassName="ml-auto label-md" />
				) : null}
				{meta.feeWaiverEndDate ? (
					<MetricRow label="Fee waiver ends" value={meta.feeWaiverEndDate} valueClassName="ml-auto label-md" />
				) : null}
			</div>
		</InfoGroup>
	)
}

function hasAttestations(meta: RWAPlatformMeta): boolean {
	return (
		meta.attestationFrequency != null ||
		meta.dateOfLastAttestation != null ||
		meta.milestones.length > 0 ||
		meta.keyMilestones != null
	)
}

function Attestations({ meta }: { meta: RWAPlatformMeta }) {
	return (
		<InfoGroup title="Attestations & milestones">
			<FactGrid>
				{meta.attestationFrequency ? (
					<ProfileField label="Attestation frequency" value={meta.attestationFrequency} wide />
				) : null}
				{meta.dateOfLastAttestation ? (
					<ProfileField label="Last attestation" value={meta.dateOfLastAttestation} />
				) : null}
			</FactGrid>
			{meta.milestones.length > 0 ? (
				<ol className="flex flex-col gap-3 border-l border-subtle pl-4">
					{meta.milestones.map((milestone, index) => (
						// oxlint-disable-next-line react/no-array-index-key -- Read-only milestone entries have no IDs and may share dates or text.
						<li key={`${milestone.date ?? 'undated'}-${index}`} className="relative flex flex-col">
							<span className="absolute top-1.5 -left-[1.2rem] size-2 rounded-full bg-brand" aria-hidden="true" />
							{milestone.date ? <span className="body-sm text-tertiary">{milestone.date}</span> : null}
							<span className="body-md">{milestone.event}</span>
						</li>
					))}
				</ol>
			) : meta.keyMilestones ? (
				<Prose>{meta.keyMilestones}</Prose>
			) : null}
		</InfoGroup>
	)
}

function SubHeading({ children }: { children: React.ReactNode }) {
	return <h3 className="label-md text-secondary">{children}</h3>
}

function RevenueMethodology({ meta }: { meta: RWAPlatformMeta }) {
	const documentGroups = collectLinkGroups([
		['Prospectus', meta.prospectusUrl],
		['Fee schedule', meta.feeScheduleUrl],
		['Issuer document', meta.issuerDocsUrl],
		['Terms and conditions', meta.tcsUrl],
		['Governance whitepaper', meta.governanceWhitepaperUrl]
	])
	const hasContent =
		meta.revenueModel != null ||
		meta.takeRateBasis != null ||
		meta.revenueMix != null ||
		meta.revenueVerificationMethod != null ||
		meta.chainShareClassFeeVariants != null ||
		meta.subsidyRebateArrangements != null ||
		meta.revenueNotes != null ||
		documentGroups.length > 0
	if (!hasContent) return null

	return (
		<Disclosure title="Revenue methodology & documents">
			{meta.revenueModel ? <RunInText label="Revenue model" value={meta.revenueModel} /> : null}
			{meta.takeRateBasis ? <RunInText label="Take-rate basis" value={meta.takeRateBasis} /> : null}
			{meta.revenueMix ? <RunInText label="Revenue mix" value={meta.revenueMix} /> : null}
			{meta.revenueVerificationMethod ? (
				<RunInText label="Verification method" value={meta.revenueVerificationMethod} />
			) : null}
			{meta.chainShareClassFeeVariants ? (
				<RunInText label="Chain/share-class variants" value={meta.chainShareClassFeeVariants} />
			) : null}
			{meta.subsidyRebateArrangements ? (
				<RunInText label="Subsidies or rebates" value={meta.subsidyRebateArrangements} />
			) : null}
			{meta.revenueNotes ? <Prose>{meta.revenueNotes}</Prose> : null}
			<DocumentLinks groups={documentGroups} />
		</Disclosure>
	)
}

function EntityBackground({ meta }: { meta: RWAPlatformMeta }) {
	const referenceGroups = collectLinkGroups([
		['Issuer source', meta.issuerSourceLink],
		['Attestation report', meta.attestationLinks],
		['Oracle proof', meta.oracleProofLink]
	])
	const founders =
		meta.foundersParsed.length > 0
			? meta.foundersParsed.map((founder) => `${founder.name}${founder.role ? ` — ${founder.role}` : ''}`).join('\n')
			: meta.founders
	const hasContent =
		founders != null ||
		meta.issuerRegistryInfo != null ||
		meta.regulatoryStatus != null ||
		meta.entityStructureNotes != null ||
		referenceGroups.length > 0
	if (!hasContent) return null

	return (
		<Disclosure title="Issuer registry, regulation & leadership">
			{founders ? (
				<div className="flex flex-col gap-1">
					<SubHeading>Founders and leadership</SubHeading>
					<p className="max-w-[70ch] body-md whitespace-pre-line text-secondary">{founders}</p>
				</div>
			) : null}
			{meta.issuerRegistryInfo ? (
				<div className="flex flex-col gap-1">
					<SubHeading>Issuer registry</SubHeading>
					<Prose>{meta.issuerRegistryInfo}</Prose>
				</div>
			) : null}
			{meta.regulatoryStatus ? (
				<div className="flex flex-col gap-1">
					<SubHeading>Regulatory status</SubHeading>
					<Prose>{meta.regulatoryStatus}</Prose>
				</div>
			) : null}
			{meta.entityStructureNotes ? (
				<div className="flex flex-col gap-1">
					<SubHeading>Entity structure</SubHeading>
					<Prose>{meta.entityStructureNotes}</Prose>
				</div>
			) : null}
			<DocumentLinks groups={referenceGroups} />
		</Disclosure>
	)
}

function Information({ data }: { data: RWAPlatformPageData }) {
	const { meta } = data
	const columns = [
		hasProfileFacts(meta) ? <ProfileFacts key="profile" meta={meta} /> : null,
		hasEconomics(meta) ? <Economics key="economics" meta={meta} /> : null,
		hasAttestations(meta) ? <Attestations key="attestations" meta={meta} /> : null
	].filter(Boolean)

	return (
		<Panel padding="none">
			<PanelHeader>
				<PanelTitle>{`About ${meta.name}`}</PanelTitle>
			</PanelHeader>
			<div className="flex flex-col gap-6 p-4">
				<Overview meta={meta} />
				<LinkRow meta={meta} />
				{columns.length > 0 ? (
					<div className="grid grid-cols-1 gap-x-8 gap-y-6 border-t border-subtle pt-6 lg:grid-cols-3">{columns}</div>
				) : null}
				<div className="flex flex-col">
					<RevenueMethodology meta={meta} />
					<EntityBackground meta={meta} />
				</div>
			</div>
		</Panel>
	)
}

/* ---------------------------------------------------------------------------
   Data views — one panel, four views of the same platform.

   Assets / Peers / Asset mix mount only while selected, so the peer-ranking
   query fires the first time a reader opens that view and never on load.
   Information is the exception: it stays mounted and is only hidden with CSS,
   so the platform's profile copy is always in the served HTML for crawlers.
--------------------------------------------------------------------------- */

export type RWAPlatformDataView = 'assets' | 'peers' | 'mix' | 'information'

/* Information leads because it answers "what is this platform?" before the
   rankings answer "how does it compare?" — but assets stays the landing view,
   so the order is presentation only and never the default. */
const DATA_VIEW_OPTIONS = [
	{ value: 'information' as const, label: 'Information' },
	{ value: 'assets' as const, label: 'Assets' },
	{ value: 'peers' as const, label: 'Peers' },
	{ value: 'mix' as const, label: 'Asset mix' }
]

const DEFAULT_DATA_VIEW: RWAPlatformDataView = 'assets'

const DATA_VIEW_PANEL_PREFIX = 'rwa-platform-view'

/** `?view=` is the shareable name of the selected view; assets is the default
    and stays out of the query string. */
export function parseRWAPlatformDataView(value: string | undefined): RWAPlatformDataView {
	for (const option of DATA_VIEW_OPTIONS) {
		if (option.value === value) return option.value
	}
	return DEFAULT_DATA_VIEW
}

export function RWAPlatformDataViews({
	data,
	renderAssetsTable
}: {
	data: RWAPlatformPageData
	renderAssetsTable: () => React.ReactNode
}) {
	const router = useRouter()
	const hasMix = data.categoryMix.length > 0 || data.assetClassMix.length > 0 || data.chainMix.length > 0
	const options = hasMix ? DATA_VIEW_OPTIONS : DATA_VIEW_OPTIONS.filter((option) => option.value !== 'mix')
	const view = parseRWAPlatformDataView(readSingleQueryValue(router.query.view))
	const activeView = view === 'mix' && !hasMix ? DEFAULT_DATA_VIEW : view

	return (
		<Tabs
			value={activeView}
			onValueChange={(nextView) => {
				void pushShallowQuery(router, { view: nextView === DEFAULT_DATA_VIEW ? undefined : nextView })
			}}
			values={options.map((option) => option.value)}
			id={DATA_VIEW_PANEL_PREFIX}
		>
			<Panel padding="sm">
				<SegmentedControl<RWAPlatformDataView>
					options={options}
					label="Platform data view"
					variant="default"
					size="md"
					semantics="tabs"
				/>
			</Panel>
			{activeView === 'assets' ? <TabPanel value="assets">{renderAssetsTable()}</TabPanel> : null}
			{activeView === 'peers' ? (
				<TabPanel value="peers">
					<PeerRanking selectedSlug={data.meta.slug} />
				</TabPanel>
			) : null}
			{activeView === 'mix' ? (
				<TabPanel value="mix">
					<AssetMix data={data} />
				</TabPanel>
			) : null}
			<TabPanel value="information">
				<Information data={data} />
			</TabPanel>
		</Tabs>
	)
}
