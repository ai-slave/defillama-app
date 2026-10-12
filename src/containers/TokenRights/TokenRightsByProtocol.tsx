import { useState, type ReactNode } from 'react'
import { BasicLink } from '~/components/Link'
import { TokenLogo } from '~/components/TokenLogo'
import type { Raise } from '~/containers/Raises/model'
import { RaisesTotal } from '~/containers/Raises/RaisesTotal'
import { summarizeRaises } from '~/containers/Raises/summary'
import { TOKEN_RIGHTS_SECTION_ID } from '~/containers/Token/types'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { CopyHelper } from '~/ui/Copy'
import { DividedGrid } from '~/ui/DividedGrid'
import { Icon } from '~/ui/Icon'
import { MetaLine } from '~/ui/MetaLine'
import { PanelTitle } from '~/ui/Panel'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { StatusBadge, type Status } from '~/ui/StatusBadge'
import { Tabs, TabPanel } from '~/ui/Tabs'
import { Tag, TagLink } from '~/ui/Tag'
import { Definition, Tooltip } from '~/ui/Tooltip'
import { formatDate } from '~/utils/dateFormat'
import { keyedOccurrences } from '~/utils/keyedOccurrences'
import {
	equityCaptureBadgeStatus,
	feeSwitchBadgeStatus,
	TokenRightsChipList,
	TokenRightsTagList
} from './TokenRightsChips'
import { TokenRightsPieChart } from './TokenRightsPieChart'
import type { ITokenRightsData, ITokenRightsParsedLink, ITokenRightsTokenDisplay } from './types'
import {
	formatFeeSwitchStatus,
	formatTokenRightsRaiseUsd,
	getTokenRightsPieFlags,
	getTokenRightsPieTones,
	hasTokenRightsPrimaryValueAccrual,
	hasTokenRightsValueAccrual
} from './utils'

const TOOLTIPS = {
	'Governance Decisions':
		'Which token grants holders the ability to participate in governance decisions such as parameter changes, upgrades and protocol direction.',
	'Treasury Decisions':
		'Which token grants holders the ability to vote on how treasury funds are allocated or deployed.',
	'Revenue Decisions':
		'Which token grants holders voting control over how protocol revenue is distributed or redirected.',
	'Fee Switch':
		'Whether the protocol has activated a mechanism to direct a share of fees to token holders through buybacks, revenue sharing or token burns. Status can be ON, OFF or PENDING.',
	Buybacks:
		'Whether the protocol uses revenue to purchase its own token on the open market, reducing circulating supply and creating buy pressure.',
	Dividends:
		'Whether the protocol distributes revenue directly to token holders, similar to a dividend or yield payment.',
	Burns:
		'Whether the protocol permanently removes tokens from circulation through a burn mechanism, reducing total supply over time.',
	Fundraising:
		'How the protocol raised initial or ongoing funding. Options: None, Unknown, Equity (sold ownership shares), Token Sale (sold tokens to investors).',
	'Raise History':
		'Information about historical fundraising rounds sourced from public announcements and verified manually.',
	'Equity Revenue Capture':
		'Whether any equity entity (Labs, parent company) captures protocol revenue separately from token holders. Active means equity holders receive revenue that could otherwise flow to token holders.',
	'Associated Entities':
		'Legal or organizational entities associated with the protocol, such as a DAO, Labs company, Foundation, or parent holding company.',
	'IP & Brand':
		"Which entity owns the intellectual property, trademarks, and brand assets of the protocol. Important for understanding who controls the project's identity.",
	Domain:
		'Which entity owns the primary domain name(s) and frontend interface of the protocol. Domain ownership affects user access and frontend fee capture.'
} as const

type TokenRightsView = 'overview' | 'details'

const TOKEN_RIGHTS_PANEL_PREFIX = 'token-rights-view'
const TOKEN_RIGHTS_VIEW_OPTIONS = [
	{ value: 'overview' as const, label: 'Overview' },
	{ value: 'details' as const, label: 'Details' }
]

interface TokenRightsByProtocolProps {
	name: string
	symbol: string | null
	tokenRightsData: ITokenRightsData
	raises: Array<Raise> | null
	showHeader?: boolean
	headerVariant?: 'protocol' | 'embedded'
	initialView?: TokenRightsView
}

export function TokenRightsByProtocol({
	name,
	symbol,
	tokenRightsData,
	raises,
	showHeader = true,
	headerVariant = 'protocol',
	initialView = 'overview'
}: TokenRightsByProtocolProps) {
	const { overview, governance, decisions, economic, valueAccrual, alignment, resources } = tokenRightsData
	const isEmbedded = headerVariant === 'embedded'
	const [activeView, setActiveView] = useState<TokenRightsView>(initialView)

	const hasOwnershipContent =
		(raises && raises.length > 0) ||
		alignment.fundraising.length > 0 ||
		alignment.equityRevenueCapture !== null ||
		alignment.associatedEntities.length > 0 ||
		alignment.ipAndBrand !== null ||
		alignment.domain !== null ||
		alignment.links.length > 0

	const hasPrimaryValueAccrual = hasTokenRightsPrimaryValueAccrual(tokenRightsData)
	const hasEquityStatement = alignment.equityStatement !== null
	// On the dedicated protocol page the header already states "$SYMBOL Token Rights", so the
	// overview card shouldn't repeat the name; surface the token-variant pills in the header instead.
	const showCardIdentity = !(showHeader && headerVariant === 'protocol')

	const content =
		activeView === 'overview' ? (
			<TokenRightsOverviewView name={name} tokenRightsData={tokenRightsData} showIdentity={showCardIdentity} />
		) : (
			<div className="grid gap-2 xl:grid-cols-2">
				{/* ── Left column ── */}
				<div className="flex flex-col gap-2">
					{/* Overview */}
					<SectionCard title="Overview">
						<dl className="empty:hidden">
							{overview.identityTokens.length > 0 ? (
								<KeyValueRow label="Token(s)">
									<TokenRightsTagList items={overview.identityTokens} />
								</KeyValueRow>
							) : null}
							{overview.tokenTypes.length > 0 ? (
								<KeyValueRow label="Token Type">
									<TokenRightsTagList items={overview.tokenTypes} />
								</KeyValueRow>
							) : null}
							{overview.utilityItems.length > 0 ? (
								<KeyValueRow label="Utility">
									<TokenRightsTagList items={overview.utilityItems} />
								</KeyValueRow>
							) : null}
						</dl>
						<p className="body-sm">{overview.description}</p>
					</SectionCard>

					{/* Governance & Decisions */}
					<SectionCard title="Governance rights" badge="Control">
						<p className="body-sm">{governance.summary}</p>
						<RightsRow
							label="Governance Decisions"
							tooltip={TOOLTIPS['Governance Decisions']}
							details={governance.details}
						>
							<DetailsTokenList display={governance.decisionTokenDisplay} />
						</RightsRow>
						<RightsRow
							label="Treasury Decisions"
							tooltip={TOOLTIPS['Treasury Decisions']}
							details={decisions.treasury.details}
						>
							<DetailsTokenList display={decisions.treasury} />
						</RightsRow>
						<RightsRow
							label="Revenue Decisions"
							tooltip={TOOLTIPS['Revenue Decisions']}
							details={decisions.revenue.details}
						>
							<DetailsTokenList display={decisions.revenue} />
						</RightsRow>
						<RightsRow label="Fee Switch" tooltip={TOOLTIPS['Fee Switch']} details={economic.feeSwitchDetails}>
							<StatusBadge status={feeSwitchBadgeStatus(economic.feeSwitchStatus)}>
								{economic.feeSwitchStatus}
							</StatusBadge>
						</RightsRow>
						<InlineLinks links={governance.links} />
					</SectionCard>

					{/* Resources */}
					{resources.addresses.length > 0 || resources.reports.length > 0 ? (
						<SectionCard title="Resources">
							{resources.addresses.length > 0 ? (
								<div className="flex flex-col gap-2 body-sm">
									{resources.addresses.every((a) => !a.label) ? (
										<h3 className="text-secondary">Foundation multisigs / addresses</h3>
									) : null}
									{keyedOccurrences(resources.addresses, (a) => a.value).map(({ item: a, key }) => {
										const isLink = a.value.startsWith('http://') || a.value.startsWith('https://')
										return (
											<div key={key} className="flex min-w-0 flex-col gap-0.5">
												{a.label ? <span className="text-secondary">{a.label}</span> : null}
												{isLink ? (
													<Button
														as={BasicLink}
														href={a.value}
														target="_blank"
														rel="noopener noreferrer"
														variant="link"
													>
														<span className="truncate">{a.value}</span>
													</Button>
												) : (
													<div className="flex items-center justify-between gap-4">
														<span className="truncate mono-sm text-secondary">{a.value}</span>
														<CopyHelper toCopy={a.value} />
													</div>
												)}
											</div>
										)
									})}
								</div>
							) : null}
							{resources.reports.length > 0 ? (
								<>
									<hr className="my-2 border-subtle" />
									<div className="flex flex-col gap-2 body-sm">
										{resources.reports.map((r) => (
											<div key={r.url} className="flex items-center justify-between gap-4">
												<span>{r.label}</span>
												<TagLink href={r.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
													{tryHostname(r.url)}
												</TagLink>
											</div>
										))}
									</div>
								</>
							) : null}
						</SectionCard>
					) : null}
				</div>

				{/* ── Right column ── */}
				<div className="flex flex-col gap-2">
					{hasPrimaryValueAccrual ? (
						<GreenCard
							title="Primary value accrual"
							tooltip="The main mechanism by which value accrues to token holders"
						>
							{valueAccrual.primary !== null ? (
								<span className="label-sm uppercase">{valueAccrual.primary}</span>
							) : null}
							{valueAccrual.details !== null ? <p className="body-sm">{valueAccrual.details}</p> : null}
						</GreenCard>
					) : null}

					{hasEquityStatement ? (
						<GreenCard
							title="Equity statement"
							tooltip="Protocol statement on the relationship between equity and token holders, and how value ultimately flows or may flow in the future"
						>
							<p className="body-sm">{alignment.equityStatement}</p>
						</GreenCard>
					) : null}

					{/* Economic Rights & Value Accrual */}
					<SectionCard title="Economic rights" badge="Value Capture">
						{economic.summary !== null ? <p className="body-sm">{economic.summary}</p> : null}
						<RightsRow label="Buybacks" tooltip={TOOLTIPS['Buybacks']} details={valueAccrual.buybacks.details}>
							<DetailsTokenList display={valueAccrual.buybacks} />
						</RightsRow>
						<RightsRow label="Dividends" tooltip={TOOLTIPS['Dividends']} details={valueAccrual.dividends.details}>
							<DetailsTokenList display={valueAccrual.dividends} />
						</RightsRow>
						<RightsRow label="Burns" tooltip={TOOLTIPS['Burns']} details={valueAccrual.burns.details}>
							<StatusBadge status={valueAccrual.burns.isActive ? 'good' : 'neutral'}>
								{valueAccrual.burns.status}
							</StatusBadge>
						</RightsRow>
						<InlineLinks links={economic.links} />
					</SectionCard>

					{/* Ownership */}
					{hasOwnershipContent ? (
						<SectionCard title="Ownership">
							{raises && raises.length > 0 ? (
								<RaiseHistorySection tooltip={TOOLTIPS['Raise History']} raises={raises} />
							) : null}
							<dl className="empty:hidden">
								{alignment.fundraising.length > 0 ? (
									<KeyValueRow label="Fundraising" tooltip={TOOLTIPS['Fundraising']}>
										<TokenRightsTagList items={alignment.fundraising} />
									</KeyValueRow>
								) : null}
								{alignment.equityRevenueCapture !== null ? (
									<KeyValueRow label="Equity Revenue Capture" tooltip={TOOLTIPS['Equity Revenue Capture']}>
										<StatusBadge status={equityCaptureBadgeStatus(alignment.equityRevenueCapture)}>
											{alignment.equityRevenueCapture}
										</StatusBadge>
									</KeyValueRow>
								) : null}
								{alignment.associatedEntities.length > 0 ? (
									<KeyValueRow label="Associated Entities" tooltip={TOOLTIPS['Associated Entities']}>
										<TokenRightsTagList items={alignment.associatedEntities} />
									</KeyValueRow>
								) : null}
								{alignment.ipAndBrand !== null ? (
									<KeyValueRow label="IP & Brand" tooltip={TOOLTIPS['IP & Brand']}>
										<TokenRightsTagList items={[alignment.ipAndBrand]} />
									</KeyValueRow>
								) : null}
								{alignment.domain !== null ? (
									<KeyValueRow label="Domain" tooltip={TOOLTIPS['Domain']}>
										<TokenRightsTagList items={[alignment.domain]} />
									</KeyValueRow>
								) : null}
							</dl>
							<InlineLinks links={alignment.links} />
						</SectionCard>
					) : null}
				</div>
			</div>
		)

	return (
		<Tabs<TokenRightsView>
			value={activeView}
			onValueChange={setActiveView}
			values={TOKEN_RIGHTS_VIEW_OPTIONS.map((option) => option.value)}
			id={TOKEN_RIGHTS_PANEL_PREFIX}
		>
			<div className={isEmbedded ? 'rounded-lg border border-subtle bg-surface' : 'grid grid-cols-1 gap-2'}>
				{showHeader ? (
					headerVariant === 'embedded' ? (
						<div className="flex flex-wrap items-center gap-2 border-b border-subtle p-2">
							<PanelTitle className="scroll-mt-24" anchor={TOKEN_RIGHTS_SECTION_ID}>
								Token rights and value accrual
							</PanelTitle>
							<TokenRightsHeaderControls updatedLabel={overview.lastUpdatedLabel} />
						</div>
					) : (
						<Card as="header" padding="sm" className="flex flex-wrap items-center gap-2">
							<TokenLogo name={name} kind="token" size={24} alt={`Logo of ${name}`} />
							<h1 className="heading-xs">{symbol ? `$${symbol}` : name} Token Rights</h1>
							{overview.identityTokens.length > 0 ? <TokenRightsTagList items={overview.identityTokens} /> : null}
							<TokenRightsHeaderControls updatedLabel={overview.lastUpdatedLabel} />
						</Card>
					)
				) : null}

				{showHeader ? (
					<TabPanel value={activeView} className={isEmbedded ? 'p-2' : undefined}>
						{content}
					</TabPanel>
				) : (
					<div className={isEmbedded ? 'p-2' : undefined}>{content}</div>
				)}
			</div>
		</Tabs>
	)
}

function TokenRightsHeaderControls({ updatedLabel }: { updatedLabel: string | null }) {
	return (
		<div className="ml-auto flex flex-wrap items-center justify-end gap-2">
			<SegmentedControl<TokenRightsView>
				options={TOKEN_RIGHTS_VIEW_OPTIONS}
				label="Token rights view"
				variant="default"
				size="md"
				semantics="tabs"
			/>
			{updatedLabel ? <span className="label-sm text-secondary">Updated {updatedLabel}</span> : null}
		</div>
	)
}

function TokenRightsOverviewView({
	name,
	tokenRightsData,
	showIdentity = true
}: {
	name: string
	tokenRightsData: ITokenRightsData
	showIdentity?: boolean
}) {
	const { overview, governance, decisions, economic, valueAccrual, alignment } = tokenRightsData
	const displayName = overview.protocolName || name
	const hasPrimaryValueAccrual = hasTokenRightsPrimaryValueAccrual(tokenRightsData)
	const hasValueAccrual = hasTokenRightsValueAccrual(tokenRightsData)
	const pieTones = getTokenRightsPieTones(getTokenRightsPieFlags(tokenRightsData))
	const rightsFields = [
		{
			label: 'Governance',
			value: <OverviewTokenValue display={governance.decisionTokenDisplay} inactiveLabel="N/A" />
		},
		{
			label: 'Treasury',
			value: <OverviewTokenValue display={decisions.treasury} inactiveLabel="N/A" />
		},
		{
			label: 'Revenue',
			value: <OverviewTokenValue display={decisions.revenue} inactiveLabel="N/A" />
		},
		{
			label: 'Fee Switch',
			value: (
				<TokenRightsToneText
					label={formatFeeSwitchStatus(economic.feeSwitchStatus)}
					status={feeSwitchBadgeStatus(economic.feeSwitchStatus)}
				/>
			)
		},
		{
			label: 'Buybacks',
			value: (
				<OverviewTokenValue
					display={valueAccrual.buybacks}
					inactiveLabel="None"
					inactiveStatus={hasValueAccrual ? 'neutral' : 'bad'}
				/>
			)
		},
		{
			label: 'Dividends',
			value: (
				<OverviewTokenValue
					display={valueAccrual.dividends}
					inactiveLabel="None"
					inactiveStatus={hasValueAccrual ? 'neutral' : 'bad'}
				/>
			)
		},
		{
			label: 'Burns',
			value: <OverviewBurnsValue status={valueAccrual.burns.status} isActive={valueAccrual.burns.isActive} />
		},
		{
			label: 'Equity Rev. Capture',
			value: <OverviewEquityCaptureValue value={alignment.equityRevenueCapture} />
		}
	]

	return (
		<Card as="section" padding="sm" className="w-full">
			<div className="grid max-w-[1040px] gap-2 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-center">
				<div className="flex min-w-0 flex-col items-center gap-2">
					<TokenRightsPieChart tones={pieTones} />
					{overview.utilityItems.length > 0 ? (
						<div className="flex w-full flex-col items-center gap-2">
							<div className="label-sm text-secondary uppercase">Utility</div>
							<TokenRightsTagList items={overview.utilityItems} />
						</div>
					) : null}
				</div>

				<div className="flex min-w-0 flex-col gap-2">
					{showIdentity ? (
						<div className="flex flex-wrap items-center gap-2">
							<h3 className="heading-xs">{displayName}</h3>
							{overview.identityTokens.length > 0 ? <TokenRightsTagList items={overview.identityTokens} /> : null}
						</div>
					) : null}

					{hasPrimaryValueAccrual ? (
						<div className="rounded-lg border border-success-muted bg-success-tint p-2">
							<div className="label-sm text-secondary uppercase">Primary Value Accrual</div>
							{valueAccrual.primary !== null ? (
								<div className="mt-1.5 label-lg text-success">{valueAccrual.primary}</div>
							) : null}
							{valueAccrual.details !== null ? <p className="mt-1.5 body-md">{valueAccrual.details}</p> : null}
						</div>
					) : null}

					<div className="overflow-x-auto">
						<div className="min-w-[640px] rounded-lg border border-subtle">
							<DividedGrid columns="grid-cols-[repeat(4,minmax(max-content,1fr))]">
								{rightsFields.map((field) => (
									<div key={field.label} className="min-w-max p-2">
										<div className="mb-1 label-sm text-secondary uppercase">{field.label}</div>
										{field.value}
									</div>
								))}
							</DividedGrid>
						</div>
					</div>

					{alignment.fundraisingLabel || alignment.associatedEntities.length > 0 ? (
						<div className="flex flex-wrap items-start gap-x-8 gap-y-2 border-t border-subtle pt-2">
							{alignment.fundraisingLabel ? (
								<div className="flex min-w-max flex-col gap-1.5">
									<div className="label-sm text-secondary uppercase">Fundraising</div>
									<TokenRightsToneText label={alignment.fundraisingLabel} status="neutral" />
								</div>
							) : null}
							{alignment.associatedEntities.length > 0 ? (
								<div className="flex min-w-0 flex-col gap-1.5">
									<div className="label-sm text-secondary uppercase">Entities</div>
									<TokenRightsTagList items={alignment.associatedEntities} />
								</div>
							) : null}
						</div>
					) : null}
				</div>
			</div>
		</Card>
	)
}

function OverviewTokenValue({
	display,
	inactiveLabel,
	inactiveStatus = 'bad'
}: {
	display: ITokenRightsTokenDisplay
	inactiveLabel: string
	inactiveStatus?: Status
}) {
	if (display.displayTokens.length === 0) {
		return <TokenRightsToneText label={inactiveLabel} status={inactiveStatus} />
	}
	return <TokenRightsChipList items={display.displayTokens} variant="overview" />
}

function OverviewBurnsValue({ status, isActive }: { status: string; isActive: boolean }) {
	if (isActive) {
		return <StatusBadge status="good">{status}</StatusBadge>
	}
	return <TokenRightsToneText label="None" status="bad" />
}

function OverviewEquityCaptureValue({ value }: { value: string | null }) {
	if (value === 'Yes') return <TokenRightsToneText label={value} status="bad" />
	if (value === 'Partial') return <TokenRightsToneText label={value} status="caution" />
	return <TokenRightsToneText label={value ?? 'Unknown'} status="neutral" />
}

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

const STATUS_TEXT_CLASSES: Record<Status, string> = {
	good: 'text-success',
	bad: 'text-error',
	caution: 'text-warning dark:text-warning',
	neutral: 'text-secondary'
}

function TokenRightsToneText({ label, status }: { label: string; status: Status }) {
	return <span className={`label-md whitespace-nowrap ${STATUS_TEXT_CLASSES[status]}`}>{label}</span>
}

function SectionCard({ title, badge, children }: { title: string; badge?: string; children: ReactNode }) {
	return (
		<Card as="section" padding="sm" className="flex flex-col gap-2">
			<div className="flex items-center justify-between">
				<h2 className="label-lg">{title}</h2>
				{badge ? <span className="label-sm text-secondary uppercase">{badge}</span> : null}
			</div>
			{children}
		</Card>
	)
}

function GreenCard({ title, tooltip, children }: { title: string; tooltip: string; children: ReactNode }) {
	return (
		<section className="flex flex-col gap-2 rounded-lg border border-success-muted bg-success-tint p-2">
			<Definition as="h2" content={tooltip} className="w-fit label-lg text-success">
				{title}
			</Definition>
			{children}
		</section>
	)
}

function KeyValueRow({ label, tooltip, children }: { label: string; tooltip?: string; children: ReactNode }) {
	return (
		<div className="flex items-center justify-between gap-4 border-b border-subtle py-2 last:border-b-0">
			<Definition as="dt" content={tooltip} className="shrink-0 body-md text-secondary">
				{label}
			</Definition>
			<dd className="flex flex-wrap items-center justify-end gap-1.5">{children}</dd>
		</div>
	)
}

function InlineLinks({ links }: { links: Array<ITokenRightsParsedLink> }) {
	if (links.length === 0) return null
	return (
		<nav className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1">
			{links.map((l) => (
				<TagLink key={l.url} href={l.url} target="_blank" rel="noopener noreferrer">
					{l.label}
				</TagLink>
			))}
		</nav>
	)
}

// ---------------------------------------------------------------------------
// Domain-specific rows
// ---------------------------------------------------------------------------

function DetailsTokenList({ display }: { display: ITokenRightsTokenDisplay }) {
	if (display.displayTokens.length > 0) {
		return <TokenRightsChipList items={display.displayTokens} variant="details" />
	}

	return <Tag>{display.fallbackToken}</Tag>
}

function RightsRow({
	label,
	tooltip,
	details,
	children
}: {
	label: string
	tooltip?: string
	details: string | null
	children: ReactNode
}) {
	return (
		<div className="flex flex-col gap-2 rounded-lg border border-subtle bg-surface-elevated-1 p-2">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<Definition as="h3" content={tooltip} className="label-md text-secondary">
					{label}
				</Definition>
				{children}
			</div>
			{details !== null ? <p className="body-sm">{details}</p> : null}
		</div>
	)
}

function RaiseHistorySection({ tooltip, raises }: { tooltip?: string; raises: Array<Raise> }) {
	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center justify-between">
				<Definition as="h3" content={tooltip} className="label-md">
					Raise history
				</Definition>
				<MetaLine>
					{`${raises.length} round${raises.length !== 1 ? 's' : ''}`}
					<span>
						<RaisesTotal {...summarizeRaises(raises)} /> total
					</span>
				</MetaLine>
			</div>
			<div className="overflow-x-auto">
				<table className="w-full text-left body-sm">
					<thead>
						<tr className="border-b border-subtle label-sm text-secondary uppercase">
							<th className="pr-4 pb-3">Date</th>
							<th className="pr-4 pb-3 text-right">Amount</th>
							<th className="pr-4 pb-3">Round</th>
							<th className="pr-4 pb-3 text-right">Valuation</th>
							<td className="w-8 pb-3" />
						</tr>
					</thead>
					<tbody>
						{keyedOccurrences(raises, (r) => JSON.stringify([r.date, r.round, r.source])).map(({ item: r, key }) => {
							return (
								<tr key={key} className="border-b border-subtle last:border-0">
									<td className="py-2.5 pr-4 whitespace-nowrap">
										{r.date ? (formatDate(r.date, { input: 'seconds' }) ?? '—') : '—'}
									</td>
									<td className="py-2.5 pr-4 text-right whitespace-nowrap">{formatTokenRightsRaiseUsd(r.amountUsd)}</td>
									<td className="py-2.5 pr-4 whitespace-nowrap">{r.round || '—'}</td>
									<td className="py-2.5 pr-4 text-right whitespace-nowrap">
										{formatTokenRightsRaiseUsd(r.valuationUsd)}
									</td>
									<td className="py-2.5">
										{r.source ? (
											<Tooltip
												content={r.source}
												render={
													<Button
														as="a"
														href={r.source}
														target="_blank"
														rel="noopener noreferrer"
														variant="ghost"
														size="sm"
														square
														aria-label="View source"
													/>
												}
											>
												<Icon name="external-link" className="size-4" />
											</Tooltip>
										) : null}
									</td>
								</tr>
							)
						})}
					</tbody>
				</table>
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tryHostname(url: string): string {
	try {
		return new URL(url).hostname
	} catch {
		return url
	}
}
