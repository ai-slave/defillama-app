import { useState, type ReactNode } from 'react'
import { CopyHelper } from '~/components/Copy'
import { Icon } from '~/components/Icon'
import { TokenLogo } from '~/components/TokenLogo'
import { Tooltip } from '~/components/Tooltip'
import type { IProtocolRaise } from '~/containers/ProtocolOverview/api.types'
import { formatRaiseAmount } from '~/containers/Raises/utils'
import { formattedNum } from '~/utils'
import type { ITokenRightsData, ITokenRightsParsedLink, ITokenRightsTokenDisplay } from './types'

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

const EMBEDDED_TOKEN_RIGHTS_SECTION_ID = 'token-rights-and-value-accrual'

type TokenRightsView = 'overview' | 'details'

interface TokenRightsByProtocolProps {
	name: string
	symbol: string | null
	tokenRightsData: ITokenRightsData
	raises: IProtocolRaise[] | null
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

	const hasPrimaryValueAccrual =
		valueAccrual.primary !== 'N/A' && (valueAccrual.primary !== null || valueAccrual.details !== null)
	const hasEquityStatement = alignment.equityStatement !== null
	// On the dedicated protocol page the header already states "$SYMBOL Token Rights", so the
	// overview card shouldn't repeat the name; surface the token-variant pills in the header instead.
	const showCardIdentity = !(showHeader && headerVariant === 'protocol')

	return (
		<div
			id={isEmbedded ? EMBEDDED_TOKEN_RIGHTS_SECTION_ID : undefined}
			className={
				isEmbedded ? 'scroll-mt-24 rounded-md border border-(--cards-border) bg-(--cards-bg)' : 'grid grid-cols-1 gap-2'
			}
		>
			{showHeader ? (
				headerVariant === 'embedded' ? (
					<div className="flex flex-wrap items-center gap-2 border-b border-(--cards-border) p-3">
						<h2 className="group relative flex items-center gap-1 text-xl font-bold">
							Token Rights and Value Accrual
							<a
								aria-hidden="true"
								tabIndex={-1}
								href={`#${EMBEDDED_TOKEN_RIGHTS_SECTION_ID}`}
								className="absolute top-0 right-0 z-10 flex size-full items-center"
							/>
							<Icon name="link" className="invisible size-3.5 group-hover:visible group-focus-visible:visible" />
						</h2>
						<TokenRightsHeaderControls
							activeView={activeView}
							updatedLabel={overview.lastUpdatedLabel}
							onChange={setActiveView}
						/>
					</div>
				) : (
					<header className="flex flex-wrap items-center gap-2 rounded-md border border-(--cards-border) bg-(--cards-bg) p-3">
						<TokenLogo name={name} kind="token" size={24} alt={`Logo of ${name}`} />
						<h1 className="text-xl font-bold">{symbol ? `$${symbol}` : name} Token Rights</h1>
						{overview.identityTokens.length > 0 ? (
							<TokenRightsChipList items={overview.identityTokens} tone="positive" variant="overview" />
						) : null}
						<TokenRightsHeaderControls
							activeView={activeView}
							updatedLabel={overview.lastUpdatedLabel}
							onChange={setActiveView}
						/>
					</header>
				)
			) : null}

			<div className={isEmbedded ? 'p-3' : undefined}>
				{activeView === 'overview' ? (
					<TokenRightsOverviewView name={name} tokenRightsData={tokenRightsData} showIdentity={showCardIdentity} />
				) : (
					<div className="grid gap-3 xl:grid-cols-2">
						{/* ── Left column ── */}
						<div className="flex flex-col gap-3">
							{/* Overview */}
							<SectionCard title="Overview">
								<dl className="divide-y divide-(--cards-border) empty:hidden">
									{overview.identityTokens.length > 0 ? (
										<KeyValueRow label="Token(s)">
											<TokenRightsChipList items={overview.identityTokens} tone="positive" variant="details" />
										</KeyValueRow>
									) : null}
									{overview.tokenTypes.length > 0 ? (
										<KeyValueRow label="Token Type">
											<TokenRightsChipList items={overview.tokenTypes} tone="neutral" variant="details" />
										</KeyValueRow>
									) : null}
									{overview.utilityItems.length > 0 ? (
										<KeyValueRow label="Utility">
											<TokenRightsChipList items={overview.utilityItems} tone="neutral" variant="details" />
										</KeyValueRow>
									) : null}
								</dl>
								<p className="text-sm text-(--text-secondary)">{overview.description}</p>
							</SectionCard>

							{/* Governance & Decisions */}
							<SectionCard title="Governance Rights" badge="Control">
								<p className="text-sm text-(--text-secondary)">{governance.summary}</p>
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
									<TokenRightsChip
										label={economic.feeSwitchStatus}
										tone={feeSwitchTone(economic.feeSwitchStatus)}
										variant="details"
									/>
								</RightsRow>
								<InlineLinks links={governance.links} />
							</SectionCard>

							{/* Resources */}
							{resources.addresses.length > 0 || resources.reports.length > 0 ? (
								<SectionCard title="Resources">
									{resources.addresses.length > 0 ? (
										<div className="flex flex-col gap-2 text-sm">
											{resources.addresses.every((a) => !a.label) ? (
												<h3 className="text-(--text-label)">Foundation Multisigs / Addresses</h3>
											) : null}
											{resources.addresses.map((a, i) => {
												const isLink = a.value.startsWith('http://') || a.value.startsWith('https://')
												return (
													<div key={`${a.value}-${i}`} className="flex min-w-0 flex-col gap-0.5">
														{a.label ? <span className="text-(--text-label)">{a.label}</span> : null}
														{isLink ? (
															<a
																href={a.value}
																target="_blank"
																rel="noopener noreferrer"
																className="truncate text-(--link) underline"
															>
																{a.value}
															</a>
														) : (
															<div className="flex items-center justify-between gap-4">
																<span className="truncate font-mono text-(--text-secondary)">{a.value}</span>
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
											<hr className="my-2 border-(--cards-border)" />
											<div className="flex flex-col gap-2 text-sm">
												{/* <h3 className="font-medium text-(--text-label)">Latest Treasury / Token Report</h3> */}
												{resources.reports.map((r) => (
													<div key={r.url} className="flex items-center justify-between gap-4">
														<span>{r.label}</span>
														<a
															href={r.url}
															target="_blank"
															rel="noopener noreferrer"
															className="inline-flex shrink-0 items-center gap-1 text-blue-500 hover:underline"
														>
															{tryHostname(r.url)}
															<Icon name="external-link" className="size-3.5" />
														</a>
													</div>
												))}
											</div>
										</>
									) : null}
								</SectionCard>
							) : null}
						</div>

						{/* ── Right column ── */}
						<div className="flex flex-col gap-3">
							{hasPrimaryValueAccrual ? (
								<GreenCard
									title="Primary Value Accrual"
									tooltip="The main mechanism by which value accrues to token holders"
								>
									{valueAccrual.primary !== null && valueAccrual.primary !== 'N/A' ? (
										<span className="text-xs font-semibold tracking-wider uppercase">{valueAccrual.primary}</span>
									) : null}
									{valueAccrual.details !== null ? (
										<p className="text-sm text-(--text-secondary)">{valueAccrual.details}</p>
									) : null}
								</GreenCard>
							) : null}

							{hasEquityStatement ? (
								<GreenCard
									title="Equity Statement"
									tooltip="Protocol statement on the relationship between equity and token holders, and how value ultimately flows or may flow in the future"
								>
									<p className="text-sm text-(--text-secondary)">{alignment.equityStatement}</p>
								</GreenCard>
							) : null}

							{/* Economic Rights & Value Accrual */}
							<SectionCard title="Economic Rights" badge="Value Capture">
								{economic.summary !== null ? (
									<p className="text-sm text-(--text-secondary)">{economic.summary}</p>
								) : null}
								<RightsRow label="Buybacks" tooltip={TOOLTIPS['Buybacks']} details={valueAccrual.buybacks.details}>
									<DetailsTokenList display={valueAccrual.buybacks} />
								</RightsRow>
								<RightsRow label="Dividends" tooltip={TOOLTIPS['Dividends']} details={valueAccrual.dividends.details}>
									<DetailsTokenList display={valueAccrual.dividends} />
								</RightsRow>
								<RightsRow label="Burns" tooltip={TOOLTIPS['Burns']} details={valueAccrual.burns.details}>
									<TokenRightsChip
										label={valueAccrual.burns.status}
										tone={valueAccrual.burns.isActive ? 'positive' : 'neutral'}
										variant="details"
									/>
								</RightsRow>
								<InlineLinks links={economic.links} />
							</SectionCard>

							{/* Ownership */}
							{hasOwnershipContent ? (
								<SectionCard title="Ownership">
									{raises && raises.length > 0 ? (
										<RaiseHistorySection tooltip={TOOLTIPS['Raise History']} raises={raises} />
									) : null}
									<dl className="divide-y divide-(--cards-border) empty:hidden">
										{alignment.fundraising.length > 0 ? (
											<KeyValueRow label="Fundraising" tooltip={TOOLTIPS['Fundraising']}>
												<TokenRightsChipList items={alignment.fundraising} tone="neutral" variant="details" />
											</KeyValueRow>
										) : null}
										{alignment.equityRevenueCapture !== null ? (
											<KeyValueRow label="Equity Revenue Capture" tooltip={TOOLTIPS['Equity Revenue Capture']}>
												<TokenRightsChip
													label={alignment.equityRevenueCapture}
													tone={equityCaptureTone(alignment.equityRevenueCapture)}
													variant="details"
												/>
											</KeyValueRow>
										) : null}
										{alignment.associatedEntities.length > 0 ? (
											<KeyValueRow label="Associated Entities" tooltip={TOOLTIPS['Associated Entities']}>
												<TokenRightsChipList items={alignment.associatedEntities} tone="neutral" variant="details" />
											</KeyValueRow>
										) : null}
										{alignment.ipAndBrand !== null ? (
											<KeyValueRow label="IP & Brand" tooltip={TOOLTIPS['IP & Brand']}>
												<TokenRightsChipList items={[alignment.ipAndBrand]} tone="neutral" variant="details" />
											</KeyValueRow>
										) : null}
										{alignment.domain !== null ? (
											<KeyValueRow label="Domain" tooltip={TOOLTIPS['Domain']}>
												<TokenRightsChipList items={[alignment.domain]} tone="neutral" variant="details" />
											</KeyValueRow>
										) : null}
									</dl>
									<InlineLinks links={alignment.links} />
								</SectionCard>
							) : null}
						</div>
					</div>
				)}
			</div>
		</div>
	)
}

function TokenRightsHeaderControls({
	activeView,
	updatedLabel,
	onChange
}: {
	activeView: TokenRightsView
	updatedLabel: string | null
	onChange: (view: TokenRightsView) => void
}) {
	return (
		<div className="ml-auto flex flex-wrap items-center justify-end gap-2">
			<TokenRightsViewToggle activeView={activeView} onChange={onChange} />
			{updatedLabel ? <span className="text-xs text-(--text-secondary)">Updated {updatedLabel}</span> : null}
		</div>
	)
}

function TokenRightsViewToggle({
	activeView,
	onChange
}: {
	activeView: TokenRightsView
	onChange: (view: TokenRightsView) => void
}) {
	return (
		<div
			role="tablist"
			aria-label="Token rights view"
			className="inline-flex items-center gap-1 rounded-md border border-(--cards-border) bg-(--app-bg) p-0.5"
		>
			{(['overview', 'details'] as const).map((view) => {
				const active = activeView === view
				return (
					<button
						key={view}
						type="button"
						role="tab"
						aria-selected={active}
						onClick={() => onChange(view)}
						className={`rounded-sm px-3 py-1 text-xs font-semibold transition-colors ${
							active
								? 'bg-(--primary) text-white shadow-sm'
								: 'text-(--text-secondary) hover:bg-(--link-hover-bg) hover:text-(--text-primary)'
						}`}
					>
						{view === 'overview' ? 'Overview' : 'Details'}
					</button>
				)
			})}
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
	const primaryValue = valueAccrual.primary ?? 'N/A'
	const pieSegments = [
		{ label: 'Treasury', active: decisions.treasury.displayTokens.length > 0 },
		{ label: 'Revenue', active: decisions.revenue.displayTokens.length > 0 },
		{ label: 'Burns', active: valueAccrual.burns.isActive },
		{ label: 'Dividends', active: valueAccrual.dividends.displayTokens.length > 0 },
		{ label: 'Buybacks', active: valueAccrual.buybacks.displayTokens.length > 0 },
		{ label: 'Governance', active: governance.decisionTokenDisplay.displayTokens.length > 0 }
	]
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
					tone={feeSwitchTone(economic.feeSwitchStatus)}
				/>
			)
		},
		{
			label: 'Buybacks',
			value: <OverviewTokenValue display={valueAccrual.buybacks} inactiveLabel="None" />
		},
		{
			label: 'Dividends',
			value: <OverviewTokenValue display={valueAccrual.dividends} inactiveLabel="None" />
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
		<section className="w-full rounded-md border border-(--cards-border) bg-(--cards-bg) p-4">
			<div className="grid max-w-[1040px] gap-4 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-center">
				<div className="flex min-w-0 flex-col items-center gap-4">
					<TokenRightsPieChart segments={pieSegments} />
					{overview.utilityItems.length > 0 ? (
						<div className="flex w-full flex-col items-center gap-2">
							<div className="text-xs font-medium tracking-wider text-(--text-label) uppercase">Utility</div>
							<TokenRightsChipList items={overview.utilityItems} tone="neutral" variant="overview" wrap />
						</div>
					) : null}
				</div>

				<div className="flex min-w-0 flex-col gap-3">
					{showIdentity ? (
						<div className="flex flex-wrap items-center gap-2">
							<h3 className="text-lg font-bold">{displayName}</h3>
							{overview.identityTokens.length > 0 ? (
								<TokenRightsChipList items={overview.identityTokens} tone="positive" variant="overview" />
							) : null}
						</div>
					) : null}

					<div className="rounded-md border border-green-600/30 bg-green-600/10 p-3">
						<div className="text-xs font-medium tracking-wider text-(--text-label) uppercase">
							Primary Value Accrual
						</div>
						<div className="mt-1.5 text-base font-semibold text-green-700 dark:text-green-400">{primaryValue}</div>
						{valueAccrual.details !== null ? (
							<p className="mt-1.5 text-sm text-(--text-secondary)">{valueAccrual.details}</p>
						) : null}
					</div>

					<div className="thin-scrollbar overflow-x-auto">
						<div className="grid min-w-[640px] grid-cols-[repeat(4,minmax(max-content,1fr))] overflow-hidden rounded-md border border-(--cards-border)">
							{rightsFields.map((field) => (
								<div
									key={field.label}
									className="min-w-max border-r border-b border-(--cards-border) px-3 py-2.5 [&:nth-child(4n)]:border-r-0 [&:nth-child(n+5)]:border-b-0"
								>
									<div className="mb-1 text-xs font-medium tracking-wider text-(--text-label) uppercase">
										{field.label}
									</div>
									{field.value}
								</div>
							))}
						</div>
					</div>

					{alignment.fundraisingLabel || alignment.associatedEntities.length > 0 ? (
						<div className="flex flex-wrap items-start gap-x-8 gap-y-4 border-t border-(--cards-border) pt-3">
							{alignment.fundraisingLabel ? (
								<div className="flex min-w-max flex-col gap-1.5">
									<div className="text-xs font-medium tracking-wider text-(--text-label) uppercase">Fundraising</div>
									<TokenRightsToneText label={alignment.fundraisingLabel} tone="neutral" />
								</div>
							) : null}
							{alignment.associatedEntities.length > 0 ? (
								<div className="flex min-w-0 flex-col gap-1.5">
									<div className="text-xs font-medium tracking-wider text-(--text-label) uppercase">Entities</div>
									<TokenRightsChipList items={alignment.associatedEntities} tone="neutral" variant="overview" wrap />
								</div>
							) : null}
						</div>
					) : null}
				</div>
			</div>
		</section>
	)
}

function TokenRightsPieChart({ segments }: { segments: Array<{ label: string; active: boolean }> }) {
	return (
		<svg viewBox="0 0 220 220" role="img" aria-label="Token rights summary" className="h-[200px] w-[200px]">
			{segments.map((segment, index) => (
				<path
					key={segment.label}
					d={PIE_SEGMENT_PATHS[index]}
					fill={segment.active ? 'var(--success)' : 'var(--error)'}
					stroke="var(--cards-bg)"
					strokeWidth="4"
				/>
			))}
			{PIE_LABELS.map((label) => (
				<text
					key={label.text}
					x={label.x}
					y={label.y}
					textAnchor="middle"
					transform={label.rotate ? `rotate(${label.rotate} ${label.x} ${label.y})` : undefined}
					className="fill-(--text-secondary) text-[13px] font-bold"
				>
					{label.text}
				</text>
			))}
		</svg>
	)
}

function OverviewTokenValue({ display, inactiveLabel }: { display: ITokenRightsTokenDisplay; inactiveLabel: string }) {
	if (display.displayTokens.length === 0) {
		return <TokenRightsToneText label={inactiveLabel} tone="negative" />
	}
	return <TokenRightsChipList items={display.displayTokens} tone="positive" variant="overview" />
}

function OverviewBurnsValue({ status, isActive }: { status: string; isActive: boolean }) {
	if (isActive) {
		return <TokenRightsChip label={status} tone="positive" variant="overview" />
	}
	return <TokenRightsToneText label="None" tone="negative" />
}

function OverviewEquityCaptureValue({ value }: { value: string | null }) {
	if (value === 'Yes') return <TokenRightsToneText label={value} tone="negative" />
	if (value === 'Partial') return <TokenRightsToneText label={value} tone="warning" />
	return <TokenRightsToneText label={value ?? 'Unknown'} tone="neutral" />
}

const PIE_LABELS = [
	{ text: 'Treasury', x: 110, y: 33, rotate: 0 },
	{ text: 'Revenue', x: 177, y: 72, rotate: 58 },
	{ text: 'Burns', x: 177, y: 154, rotate: -58 },
	{ text: 'Dividends', x: 110, y: 198, rotate: 0 },
	{ text: 'Buybacks', x: 43, y: 154, rotate: 58 },
	{ text: 'Governance', x: 43, y: 72, rotate: -58 }
] as const

const PIE_SEGMENT_PATHS = [
	'M 110 110 L 76 51.11 A 68 68 0 0 1 144 51.11 Z',
	'M 110 110 L 144 51.11 A 68 68 0 0 1 178 110 Z',
	'M 110 110 L 178 110 A 68 68 0 0 1 144 168.89 Z',
	'M 110 110 L 144 168.89 A 68 68 0 0 1 76 168.89 Z',
	'M 110 110 L 76 168.89 A 68 68 0 0 1 42 110 Z',
	'M 110 110 L 42 110 A 68 68 0 0 1 76 51.11 Z'
] as const

function formatFeeSwitchStatus(value: string): string {
	switch (value) {
		case 'ON':
			return 'On'
		case 'OFF':
			return 'Off'
		case 'PENDING':
			return 'Pending'
		default:
			return value || 'Unknown'
	}
}

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

type StatusTone = 'positive' | 'negative' | 'warning' | 'neutral'
type TokenRightsChipVariant = 'overview' | 'details'

const CHIP_TONE_CLASSES: Record<TokenRightsChipVariant, Record<StatusTone, string>> = {
	overview: {
		positive: 'border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400',
		negative: 'border-red-600/30 bg-red-600/10 text-red-700 dark:text-red-400',
		warning: 'border-amber-600/30 bg-amber-600/10 text-amber-700 dark:text-amber-400',
		neutral: 'border-(--cards-border) bg-(--cards-bg) text-(--text-secondary)'
	},
	details: {
		positive: 'border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400',
		negative: 'border-red-600/30 bg-red-600/10 text-red-700 dark:text-red-400',
		warning: 'border-amber-600/30 bg-amber-600/10 text-amber-700 dark:text-amber-400',
		neutral: 'border-(--cards-border) bg-(--app-bg) text-(--text-secondary)'
	}
}

const TEXT_TONE_CLASSES: Record<StatusTone, string> = {
	positive: 'text-green-700 dark:text-green-400',
	negative: 'text-red-600 dark:text-red-400',
	warning: 'text-amber-600 dark:text-amber-400',
	neutral: 'text-(--text-secondary)'
}

function TokenRightsToneText({ label, tone }: { label: string; tone: StatusTone }) {
	return <span className={`text-sm font-medium whitespace-nowrap ${TEXT_TONE_CLASSES[tone]}`}>{label}</span>
}

function TokenRightsChipList({
	items,
	tone,
	variant,
	wrap
}: {
	items: string[]
	tone: StatusTone
	variant: TokenRightsChipVariant
	wrap?: boolean
}) {
	const shouldWrap = wrap ?? variant === 'details'
	return (
		<div className={`flex items-center gap-1.5 ${shouldWrap ? 'flex-wrap' : 'flex-nowrap'}`}>
			{items.map((item, index) => (
				<TokenRightsChip key={`${item}-${index}`} label={item} tone={tone} variant={variant} />
			))}
		</div>
	)
}

function TokenRightsChip({
	label,
	tone,
	variant
}: {
	label: string
	tone: StatusTone
	variant: TokenRightsChipVariant
}) {
	const shapeClass = variant === 'overview' ? 'rounded-md px-2 py-0.5 font-medium' : 'rounded-full px-2.5 py-0.5'
	return (
		<span
			className={`inline-flex w-fit shrink-0 items-center border text-sm whitespace-nowrap ${shapeClass} ${CHIP_TONE_CLASSES[variant][tone]}`}
		>
			{label}
		</span>
	)
}

function SectionCard({ title, badge, children }: { title: string; badge?: string; children: ReactNode }) {
	return (
		<section className="flex flex-col gap-4 rounded-md border border-(--cards-border) bg-(--cards-bg) p-3">
			<div className="flex items-center justify-between">
				<h2 className="text-base font-semibold">{title}</h2>
				{badge ? (
					<span className="text-xs font-medium tracking-wider text-(--text-secondary) uppercase">{badge}</span>
				) : null}
			</div>
			{children}
		</section>
	)
}

function GreenCard({ title, tooltip, children }: { title: string; tooltip: string; children: ReactNode }) {
	return (
		<section className="flex flex-col gap-3 rounded-md border border-green-600/30 bg-green-600/10 p-3">
			<Tooltip
				content={tooltip}
				render={<h2 />}
				className="w-fit text-base font-semibold text-green-700 underline decoration-dotted dark:text-green-400"
			>
				{title}
			</Tooltip>
			{children}
		</section>
	)
}

function KeyValueRow({ label, tooltip, children }: { label: string; tooltip?: string; children: ReactNode }) {
	return (
		<div className="flex items-center justify-between gap-4 py-2.5">
			{tooltip ? (
				<Tooltip
					content={tooltip}
					render={<dt />}
					className="shrink-0 text-sm text-(--text-secondary) underline decoration-dotted"
				>
					{label}
				</Tooltip>
			) : (
				<dt className="shrink-0 text-sm text-(--text-secondary)">{label}</dt>
			)}
			<dd className="flex flex-wrap items-center justify-end gap-1.5">{children}</dd>
		</div>
	)
}

function InlineLinks({ links }: { links: ITokenRightsParsedLink[] }) {
	if (links.length === 0) return null
	return (
		<nav className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1">
			{links.map((l) => (
				<a
					key={l.url}
					href={l.url}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-1 text-sm text-blue-500 hover:underline"
				>
					<Icon name="external-link" className="size-3 shrink-0" />
					{l.label}
				</a>
			))}
		</nav>
	)
}

// ---------------------------------------------------------------------------
// Domain-specific rows
// ---------------------------------------------------------------------------

function DetailsTokenList({ display }: { display: ITokenRightsTokenDisplay }) {
	if (display.displayTokens.length > 0) {
		return <TokenRightsChipList items={display.displayTokens} tone="positive" variant="details" />
	}

	return <TokenRightsChip label={display.fallbackToken} tone="neutral" variant="details" />
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
		<div className="flex flex-col gap-2 rounded-md border border-(--cards-border) bg-white/2 p-3 dark:bg-white/3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				{tooltip ? (
					<Tooltip content={tooltip} render={<h3 />} className="text-sm font-bold underline decoration-dotted">
						{label}
					</Tooltip>
				) : (
					<h3 className="text-sm font-bold">{label}</h3>
				)}
				{children}
			</div>
			{details !== null ? <p className="text-sm text-(--text-secondary)">{details}</p> : null}
		</div>
	)
}

function RaiseHistorySection({ tooltip, raises }: { tooltip?: string; raises: IProtocolRaise[] }) {
	const totalAmount = raises.reduce((sum, r) => sum + (r.amount || 0), 0)

	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center justify-between">
				{tooltip ? (
					<Tooltip content={tooltip} render={<h3 />} className="text-sm font-semibold underline decoration-dotted">
						Raise History
					</Tooltip>
				) : (
					<h3 className="text-sm font-semibold">Raise History</h3>
				)}
				<span className="text-xs text-(--text-secondary)">
					{raises.length} round{raises.length !== 1 ? 's' : ''} · {formattedNum(totalAmount * 1_000_000, true)} total
				</span>
			</div>
			<div className="overflow-x-auto">
				<table className="w-full text-left text-sm">
					<thead>
						<tr className="border-b border-(--cards-border) text-xs font-medium tracking-wider text-(--text-label) uppercase">
							<th className="pr-4 pb-3">Date</th>
							<th className="pr-4 pb-3 text-right">Amount</th>
							<th className="pr-4 pb-3">Round</th>
							<th className="pr-4 pb-3 text-right">Valuation</th>
							<th className="w-8 pb-3" />
						</tr>
					</thead>
					<tbody>
						{raises.map((r, i) => {
							const valuation = formatRaiseAmount(r.valuation)
							return (
								<tr key={`${r.date}-${r.round}-${i}`} className="border-b border-(--cards-border) last:border-0">
									<td className="py-2.5 pr-4 whitespace-nowrap">
										{r.date
											? new Date(r.date * 1000).toLocaleDateString(undefined, {
													day: '2-digit',
													month: 'short',
													year: 'numeric'
												})
											: '—'}
									</td>
									<td className="py-2.5 pr-4 text-right font-jetbrains whitespace-nowrap tabular-nums">
										{r.amount ? formattedNum(r.amount * 1_000_000, true) : '—'}
									</td>
									<td className="py-2.5 pr-4 whitespace-nowrap">{r.round || '—'}</td>
									<td className="py-2.5 pr-4 text-right font-jetbrains whitespace-nowrap tabular-nums">
										{valuation != null ? formattedNum(valuation, true) : '—'}
									</td>
									<td className="py-2.5">
										{r.source ? (
											<a
												href={r.source}
												target="_blank"
												rel="noopener noreferrer"
												className="text-(--text-secondary) hover:text-(--text-primary)"
											>
												<Icon name="external-link" className="size-3.5" />
											</a>
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

function feeSwitchTone(status: string): StatusTone {
	switch (status) {
		case 'ON':
			return 'positive'
		case 'PENDING':
			return 'warning'
		case 'OFF':
			return 'negative'
		default:
			return 'neutral'
	}
}

function equityCaptureTone(val: string): StatusTone {
	switch (val) {
		case 'Yes':
			return 'negative'
		case 'Partial':
			return 'warning'
		case 'No':
			return 'positive'
		default:
			return 'neutral'
	}
}
