import { ExternalLinkButton } from '~/components/ExternalLinkButton'
import { BasicLink } from '~/components/Link'
import { Menu } from '~/components/Menu'
import { TokenLogo } from '~/components/TokenLogo'
import { buttonStyles } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import { MetricRow } from '~/ui/MetricPrimitives'
import { StatItem } from '~/ui/SummaryStats'
import { formatCompactNumber, formatNumber, formatPercent, formatUsd } from '~/utils/numberFormat'
import type { RWAPlatformMeta } from './api.types'
import { PeerRanking } from './PeerRanking'
import type { RWAPlatformMixRow, RWAPlatformPageData } from './types'

const compactUsdOptions = {
	compact: true,
	minimumCompactValue: 1_000_000,
	compactSuffix: 'lowercase'
} as const

const linkButtonStyles = buttonStyles({ variant: 'secondary', size: 'md' })

function SectionCard({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
	return (
		<Card as="section" padding="sm" className="flex flex-col gap-3">
			<h2 className="heading-xs">{title}</h2>
			{children}
		</Card>
	)
}

function formatBps(value: number): string {
	return `${formatNumber(value)} bps`
}

/** Methodology-style run-in: secondary medium label, primary sentence body. */
function RunInText({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<p className="body-md">
			<span className="font-medium text-secondary">{label}:</span> {value}
		</p>
	)
}

/** Asset-Information-style stacked pair: secondary label over a medium value. */
function ProfileField({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<p className="flex flex-col gap-1">
			<span className="text-secondary">{label}</span>
			<span className="font-medium">{value}</span>
		</p>
	)
}

function ProfileText({ title, value }: { title: string; value: string }) {
	return (
		<div className="flex flex-col gap-1">
			<h3 className="font-semibold">{title}</h3>
			<p className="body-md text-secondary">{value}</p>
		</div>
	)
}

export function RWAPlatformHeader({ data }: { data: RWAPlatformPageData }) {
	const { meta } = data
	const tags = [...(meta.platformType ?? []), ...(meta.category ?? []), ...(meta.accessModel ? [meta.accessModel] : [])]

	const facts: Array<{ label: string; value: React.ReactNode }> = []
	if (meta.foundedYear != null) facts.push({ label: 'Founded', value: meta.foundedYear })
	if (meta.headquarters) facts.push({ label: 'Headquarters', value: meta.headquarters })
	if (meta.primaryChain) facts.push({ label: 'Primary chain', value: meta.primaryChain })
	if (meta.oracleProvider) facts.push({ label: 'Oracle', value: meta.oracleProvider })

	const hasLinks =
		(meta.website?.length ?? 0) > 0 ||
		meta.twitter != null ||
		meta.docs != null ||
		meta.linkedin != null ||
		meta.discord != null ||
		meta.telegram != null ||
		meta.rwaGithub != null ||
		meta.protocolSlug != null

	const uniqueTags = Array.from(new Set(tags))
	const showProfile = meta.description != null || uniqueTags.length > 0 || facts.length > 0 || hasLinks

	return (
		<div className="grid grid-cols-1 items-start gap-2 xl:grid-cols-3">
			<Card padding="sm" className={`flex flex-col gap-6${showProfile ? '' : ' xl:col-span-3'}`}>
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
				<div className="flex flex-col">
					<h2 className="mb-2 font-semibold">Key Metrics</h2>
					<MetricRow label="Live assets" value={formatCompactNumber(data.assetCount)} />
					<MetricRow label="Chains" value={formatCompactNumber(data.chainCount)} />
					{meta.estAnnualRevenueUsd != null ? (
						<MetricRow label="Est. annual revenue" value={formatUsd(meta.estAnnualRevenueUsd, compactUsdOptions)} />
					) : null}
					<MetricRow label="DeFi TVL" value={formatUsd(data.defiActiveTvl, compactUsdOptions)} />
					{data.defiActiveTvlToAumPct != null ? (
						<MetricRow
							label="DeFi TVL / AUM"
							value={formatPercent(data.defiActiveTvlToAumPct, {
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
			</Card>
			{showProfile ? (
				<Card padding="sm" className="flex flex-col gap-3 xl:col-span-2">
					{meta.description ? <p className="body-md text-secondary">{meta.description}</p> : null}
					{uniqueTags.length > 0 ? (
						<div className="flex flex-wrap gap-1.5">
							{uniqueTags.map((tag) => (
								<span key={tag} className="rounded-full bg-surface-elevated-2 px-2 py-0.5 label-sm text-secondary">
									{tag}
								</span>
							))}
						</div>
					) : null}
					{facts.length > 0 ? (
						<dl className="flex flex-wrap gap-x-6 gap-y-2">
							{facts.map((fact) => (
								<div key={fact.label} className="flex items-baseline gap-1.5">
									<dt className="body-md text-secondary">{fact.label}</dt>
									<dd className="label-md">{fact.value}</dd>
								</div>
							))}
						</dl>
					) : null}
					{hasLinks ? (
						<div className="flex flex-wrap gap-3">
							{meta.website ? (
								meta.website.length > 1 ? (
									<Menu name="Website" options={meta.website} isExternal className={linkButtonStyles} />
								) : (
									<ExternalLinkButton key={meta.website[0]} href={meta.website[0]} icon="globe">
										Website
									</ExternalLinkButton>
								)
							) : null}
							{meta.twitter ? (
								<ExternalLinkButton href={meta.twitter} icon="twitter">
									Twitter
								</ExternalLinkButton>
							) : null}
							{meta.docs ? (
								<ExternalLinkButton href={meta.docs} icon="file-text">
									Docs
								</ExternalLinkButton>
							) : null}
							{meta.linkedin ? (
								<ExternalLinkButton href={meta.linkedin} icon="linkedin">
									LinkedIn
								</ExternalLinkButton>
							) : null}
							{meta.discord ? (
								<ExternalLinkButton href={meta.discord} icon="discord">
									Discord
								</ExternalLinkButton>
							) : null}
							{meta.telegram ? (
								<ExternalLinkButton href={meta.telegram} icon="telegram">
									Telegram
								</ExternalLinkButton>
							) : null}
							{meta.rwaGithub ? (
								<ExternalLinkButton href={meta.rwaGithub} icon="github">
									GitHub
								</ExternalLinkButton>
							) : null}
							{meta.protocolSlug ? (
								<BasicLink href={`/protocol/${meta.protocolSlug}`} className={linkButtonStyles}>
									<span>Protocol page</span>
								</BasicLink>
							) : null}
						</div>
					) : null}
				</Card>
			) : null}
		</div>
	)
}

function hasEconomics(meta: RWAPlatformMeta): boolean {
	return (
		meta.revenueModel != null ||
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
		meta.revenueNotes != null ||
		meta.revenueVerificationMethod != null ||
		meta.chainShareClassFeeVariants != null ||
		meta.subsidyRebateArrangements != null ||
		meta.takeRateBasis != null ||
		meta.revenueMix != null ||
		(meta.marginSettlementAsset?.length ?? 0) > 0 ||
		(meta.prospectusUrl?.length ?? 0) > 0 ||
		(meta.feeScheduleUrl?.length ?? 0) > 0 ||
		(meta.issuerDocsUrl?.length ?? 0) > 0 ||
		(meta.tcsUrl?.length ?? 0) > 0 ||
		(meta.governanceWhitepaperUrl?.length ?? 0) > 0
	)
}

function Economics({ meta }: { meta: RWAPlatformMeta }) {
	const documentGroups: Array<{ label: string; urls: string[] }> = []
	for (const [label, urls] of [
		['Prospectus', meta.prospectusUrl],
		['Fee schedule', meta.feeScheduleUrl],
		['Issuer document', meta.issuerDocsUrl],
		['Terms and conditions', meta.tcsUrl],
		['Governance whitepaper', meta.governanceWhitepaperUrl]
	] as const) {
		if (urls && urls.length > 0) documentGroups.push({ label, urls })
	}

	return (
		<SectionCard title="Economics & revenue">
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
			{meta.revenueNotes ? <p className="body-md text-secondary">{meta.revenueNotes}</p> : null}
			{documentGroups.length > 0 ? (
				<div className="flex flex-wrap gap-3">
					{documentGroups.map((group) =>
						group.urls.length > 1 ? (
							<Menu key={group.label} name={group.label} options={group.urls} isExternal className={linkButtonStyles} />
						) : (
							<ExternalLinkButton key={group.label} href={group.urls[0]} icon="file-text">
								{group.label}
							</ExternalLinkButton>
						)
					)}
				</div>
			) : null}
		</SectionCard>
	)
}

function MixList({ rows }: { rows: RWAPlatformMixRow[] }) {
	const visibleRows = rows.slice(0, 8)
	const maxCount = visibleRows[0]?.count ?? 0
	return (
		<div className="flex flex-col gap-2">
			{visibleRows.map((row) => (
				<div key={row.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
					<span className="truncate body-md">{row.name}</span>
					<span className="label-md">{formatCompactNumber(row.count)}</span>
					<span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-surface-elevated-2">
						<span
							className="block h-full rounded-full bg-brand"
							style={{
								width: `${maxCount > 0 ? (row.count / maxCount) * 100 : 0}%`
							}}
						/>
					</span>
				</div>
			))}
			{rows.length > visibleRows.length ? (
				<p className="body-sm text-tertiary">+{rows.length - visibleRows.length} more</p>
			) : null}
		</div>
	)
}

function MixGroup({ title, rows }: { title: string; rows: RWAPlatformMixRow[] }) {
	return (
		<div className="flex flex-col gap-3">
			<h3 className="label-md text-secondary">{title}</h3>
			<MixList rows={rows} />
		</div>
	)
}

function AssetMix({ data }: { data: RWAPlatformPageData }) {
	const hasMix = data.categoryMix.length > 0 || data.assetClassMix.length > 0 || data.chainMix.length > 0
	if (!hasMix) return null
	return (
		<SectionCard title="Asset mix">
			<div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
				{data.categoryMix.length > 0 ? <MixGroup title="Categories" rows={data.categoryMix} /> : null}
				{data.assetClassMix.length > 0 ? <MixGroup title="Asset classes" rows={data.assetClassMix} /> : null}
				{data.chainMix.length > 0 ? <MixGroup title="Chain deployments" rows={data.chainMix} /> : null}
			</div>
		</SectionCard>
	)
}

function hasEntityProfile(meta: RWAPlatformMeta): boolean {
	return (
		meta.issuer != null ||
		meta.foundersParsed.length > 0 ||
		meta.founders != null ||
		meta.regulatoryStatus != null ||
		meta.entityStructureNotes != null ||
		meta.milestones.length > 0 ||
		meta.keyMilestones != null ||
		meta.attestationFrequency != null ||
		meta.dateOfLastAttestation != null ||
		meta.llamaGradeAttestation != null ||
		meta.issuerRegistryInfo != null ||
		(meta.refLinks?.length ?? 0) > 0 ||
		(meta.issuerSourceLink?.length ?? 0) > 0 ||
		(meta.attestationLinks?.length ?? 0) > 0 ||
		(meta.oracleProofLink?.length ?? 0) > 0
	)
}

function EntityProfile({ meta }: { meta: RWAPlatformMeta }) {
	const hasMilestones = meta.milestones.length > 0 || meta.keyMilestones != null
	return (
		<SectionCard title="Entity profile">
			<div className={`grid grid-cols-1 gap-6 ${hasMilestones ? 'lg:grid-cols-2' : ''}`}>
				<div className="flex flex-col gap-3">
					{meta.issuer ? <ProfileField label="Issuer" value={meta.issuer} /> : null}
					{meta.parentPlatform ? <ProfileField label="Parent platform" value={meta.parentPlatform} /> : null}
					{meta.issuerRegistryInfo ? <ProfileField label="Issuer registry" value={meta.issuerRegistryInfo} /> : null}
					{meta.attestationFrequency ? (
						<ProfileField label="Attestation frequency" value={meta.attestationFrequency} />
					) : null}
					{meta.dateOfLastAttestation ? (
						<ProfileField label="Last attestation" value={meta.dateOfLastAttestation} />
					) : null}
					{meta.llamaGradeAttestation != null ? (
						<ProfileField label="Llama-grade attestation" value={meta.llamaGradeAttestation ? 'Yes' : 'No'} />
					) : null}
					{meta.foundersParsed.length > 0 ? (
						<div className="flex flex-col gap-2">
							<h3 className="font-semibold">Founders and leadership</h3>
							<ul className="flex flex-col gap-1 body-md text-secondary">
								{meta.foundersParsed.map((founder) => (
									<li key={`${founder.name}-${founder.role ?? ''}`}>
										{founder.name}
										{founder.role ? ` — ${founder.role}` : ''}
									</li>
								))}
							</ul>
						</div>
					) : meta.founders ? (
						<ProfileText title="Founders and leadership" value={meta.founders} />
					) : null}
					{meta.regulatoryStatus ? <ProfileText title="Regulatory status" value={meta.regulatoryStatus} /> : null}
					{meta.entityStructureNotes ? (
						<ProfileText title="Entity structure" value={meta.entityStructureNotes} />
					) : null}
				</div>
				{hasMilestones ? (
					<div className="flex flex-col gap-3">
						<h3 className="font-semibold">Milestones</h3>
						{meta.milestones.length > 0 ? (
							<ol className="flex flex-col gap-4 border-l border-subtle pl-4">
								{meta.milestones.map((milestone, index) => (
									<li key={`${milestone.date ?? 'undated'}-${index}`} className="relative flex flex-col gap-1">
										<span className="absolute top-1.5 -left-[1.2rem] size-2 rounded-full bg-brand" aria-hidden="true" />
										{milestone.date ? <p className="body-sm text-tertiary">{milestone.date}</p> : null}
										<p className="body-md">{milestone.event}</p>
									</li>
								))}
							</ol>
						) : meta.keyMilestones ? (
							<p className="body-md text-secondary">{meta.keyMilestones}</p>
						) : null}
					</div>
				) : null}
			</div>
			<ProfileLinks meta={meta} />
		</SectionCard>
	)
}

function ProfileLinks({ meta }: { meta: RWAPlatformMeta }) {
	const groups: Array<{ label: string; urls: string[] }> = []
	for (const [label, urls] of [
		['Reference', meta.refLinks],
		['Issuer source', meta.issuerSourceLink],
		['Attestation report', meta.attestationLinks],
		['Oracle proof', meta.oracleProofLink]
	] as const) {
		if (urls && urls.length > 0) groups.push({ label, urls })
	}
	if (groups.length === 0) return null
	return (
		<div className="flex flex-wrap gap-3 border-t border-subtle pt-3">
			{groups.map((group) =>
				group.urls.length > 1 ? (
					<Menu key={group.label} name={group.label} options={group.urls} isExternal className={linkButtonStyles} />
				) : (
					<ExternalLinkButton key={group.label} href={group.urls[0]}>
						{group.label}
					</ExternalLinkButton>
				)
			)}
		</div>
	)
}

export function RWAPlatformDetails({ data }: { data: RWAPlatformPageData }) {
	const showEconomics = hasEconomics(data.meta)
	const showEntityProfile = hasEntityProfile(data.meta)
	return (
		<div className="flex flex-col gap-2">
			{showEconomics || showEntityProfile ? (
				<div
					className={`grid grid-cols-1 items-start gap-2 ${showEconomics && showEntityProfile ? 'lg:grid-cols-2' : ''}`}
				>
					{showEconomics ? <Economics meta={data.meta} /> : null}
					{showEntityProfile ? <EntityProfile meta={data.meta} /> : null}
				</div>
			) : null}
			<AssetMix data={data} />
			<PeerRanking selectedSlug={data.meta.slug} />
		</div>
	)
}
