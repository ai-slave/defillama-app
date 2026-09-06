import type { BlockExplorersResponse } from '~/api/types'
import { BasicLink } from '~/components/Link'
import { TokenLogo } from '~/components/TokenLogo'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import { slug } from '~/utils'
import { getBlockExplorerNew } from '~/utils/blockExplorers'
import { formatUsd } from '~/utils/numberFormat'
import { positionUsd, type AllocationVM } from '../allocation'
import { collateralDepegLossUsd, collateralMarketBreakLossUsd, marketBreakPresentation } from '../derive'
import { trustScopeTooltip } from '../format'
import { oracleBadge, toneClasses } from '../kindMeta'
import { AddressActions } from '../primitives/AddressActions'
import type { CollateralVM, MarketOracle, OracleLeg, PoolType } from '../types'
import { dropLabel, isProvenVendor, PtPricingChip, SLIDER_THUMB, vaultSharePct } from './collateralShared'
import { usePositionUsd } from './PositionControl'

const DETAIL_LABEL = 'label-md text-primary'

// Proven feed vendor(s), or the honest gap ("no live feed") on a hardcoded oracle.
function oracleVendorLabel(c: CollateralVM): string | null {
	const provs = [...new Set(c.oracleProviders.filter(isProvenVendor))]
	if (provs.length > 0) return provs.join(' / ')
	if (c.oracleType === 'hardcoded') return 'no live feed'
	return null
}

// Base/quote legs of a composite price path; renders nothing unless at least one leg resolved.
function OraclePricePath({ base, quote }: { base: string | null; quote: string | null }) {
	if (!base && !quote) return null
	const legs = [base && { k: 'Base', v: base }, quote && { k: 'Quote', v: quote }].filter(Boolean) as Array<{
		k: string
		v: string
	}>
	return (
		<div className="flex flex-col gap-0.5">
			{legs.map(({ k, v }) => (
				<span key={k} className="flex items-center gap-2">
					<span className="w-10 shrink-0 label-sm text-secondary">{k}</span>
					<span className="text-secondary">{v}</span>
				</span>
			))}
		</div>
	)
}

const LEG_KIND_LABEL: Record<string, string> = {
	market: 'Market',
	'exchange-rate': 'Exchange rate',
	nav: 'NAV',
	vault: 'Vault'
}

function legKindLabel(kind: string): string {
	return LEG_KIND_LABEL[kind] ?? kind.replace(/[-_]/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())
}

// base1/base2/base_vault → "Base", quote* → "Quote"; the side label heads each group.
function legSide(slot: string): string {
	if (slot.startsWith('base')) return 'Base'
	if (slot.startsWith('quote')) return 'Quote'
	return ''
}

// The resolved on-chain legs the oracle reads, in order. `kind` is a classification, not a
// severity, so its chip stays neutral.
function OracleLegs({ legs }: { legs: Array<OracleLeg> }) {
	return (
		<div className="flex flex-col gap-1">
			{legs.map((leg, i) => {
				const side = legSide(leg.slot)
				const showSide = i === 0 || legSide(legs[i - 1]!.slot) !== side
				return (
					<span key={`${leg.slot}-${i}`} className="flex items-start gap-2">
						<span className="w-10 shrink-0 pt-0.5 label-sm text-secondary">{showSide ? side : ''}</span>
						<span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
							<span className="text-secondary">{leg.description}</span>
							<span className="inline-flex shrink-0 items-center rounded-full border border-medium bg-surface px-1.5 py-0.5 label-xs text-secondary">
								{legKindLabel(leg.kind)}
							</span>
							{leg.vendor ? <span className="body-sm text-tertiary">{leg.vendor}</span> : null}
						</span>
					</span>
				)
			})}
		</div>
	)
}

// The lead "Market Exposure" value + sub-line, framed by marketBreakPresentation: unmodeled
// reads "Not modeled" with the ceiling, a confident zero reads "no bad debt", estimates get "≈".
function MarketBreakCell({
	c,
	showShare,
	shareWord,
	sharePct,
	variant
}: {
	c: CollateralVM
	showShare: boolean
	shareWord: string
	sharePct: string
	variant: 'mobile' | 'desktop'
}) {
	const p = marketBreakPresentation(c)
	if (p.kind === 'unmodeled')
		return (
			<>
				<span className="label-md text-secondary">Not modeled</span>
				<span className="body-sm text-tertiary">{`up to ${formatUsd(p.ceilingUsd, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} exposed`}</span>
			</>
		)
	if (p.kind === 'confident-zero')
		return (
			<>
				<span className={`label-md ${toneClasses('good').text}`}>no bad debt</span>
				{variant === 'mobile' ? <span className="body-sm text-tertiary">no modeled path</span> : null}
			</>
		)
	// The share leads (it's the same figure for every depositor); the dollar amount is the
	// pool-wide one, so it drops to the sub-line.
	const sub = [
		showShare ? shareWord : null,
		p.approximate ? 'est.' : variant === 'mobile' ? 'bad debt' : null,
		formatUsd(p.usd, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
	]
		.filter(Boolean)
		.join(' · ')
	return (
		<>
			<span className="label-md text-primary tabular-nums">{`${p.approximate ? '≈ ' : ''}${sharePct}`}</span>
			<span className="body-sm whitespace-nowrap text-tertiary tabular-nums">{sub}</span>
		</>
	)
}

// `className` carries layout only — the ink is owned here so the empty-value tier can't collide
// with a caller's text colour.
function OracleExposureValue({
	c,
	supplyUsd,
	className
}: {
	c: CollateralVM
	supplyUsd: number | null
	className: string
}) {
	if (c.drainableUsd == null || c.drainableUsd <= 0)
		return <span className={`${className} label-md text-tertiary`}>—</span>
	return (
		<span className={`${className} label-md text-primary`}>
			{supplyUsd != null && supplyUsd > 0
				? vaultSharePct(c.drainableUsd / supplyUsd)
				: formatUsd(c.drainableUsd, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
		</span>
	)
}

// Each asset owns its own drop: this row's slider is the only place that drop is set, and
// VaultStress above just sums whatever every row is currently set to.
function DepegWhatIf({
	c,
	supplyUsd,
	drop,
	onDropChange
}: {
	c: CollateralVM
	supplyUsd: number | null
	drop: number
	onDropChange?: (drop: number) => void
}) {
	const [position] = usePositionUsd()
	const p = marketBreakPresentation(c)
	// Modeled bad debt reads as a share of the deposit; the pool-wide dollars stay secondary.
	const share = (usd: number) =>
		supplyUsd != null && supplyUsd > 0
			? vaultSharePct(usd / supplyUsd)
			: formatUsd(usd, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
	if (c.exposureUsd <= 0)
		return <span className="text-secondary">No current position in this market — a depeg here costs you nothing.</span>
	if (p.kind === 'unmodeled')
		return (
			<span className="text-secondary">
				{'Bad debt isn’t modeled for this reserve. Up to '}
				<span className="text-primary">
					{formatUsd(p.ceilingUsd, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
				</span>
				{' is exposed if its market breaks — a ceiling capped at market size, not a modeled loss.'}
			</span>
		)
	if (p.kind === 'confident-zero')
		return (
			<span className="text-secondary">No borrowing is drawn against this collateral — no modeled bad-debt path.</span>
		)
	if (p.approximate) {
		// market-wide basis has no per-position LLTV curve — show the flat all-break estimate,
		// not a slider that does nothing.
		const yourShareApprox =
			position != null && supplyUsd != null && supplyUsd > 0 ? p.usd * Math.min(1, position / supplyUsd) : null
		return (
			<span className="flex flex-col gap-1 text-secondary">
				<span className="flex flex-wrap items-baseline gap-x-1.5">
					{'≈ '}
					<span className="label-md text-primary">{share(p.usd)}</span>
					{' of deposit in estimated bad debt if this market breaks'}
					{yourShareApprox != null
						? ` · ≈ ${formatUsd(yourShareApprox, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} of yours`
						: null}
				</span>
				<span className="body-sm text-tertiary">Market-wide estimate — not a position-level figure.</span>
			</span>
		)
	}
	const poolLoss = collateralDepegLossUsd(c, drop / 100)
	const buffered = poolLoss <= 0
	const yourShare =
		!buffered && position != null && supplyUsd != null && supplyUsd > 0
			? poolLoss * Math.min(1, position / supplyUsd)
			: null
	const capUsd = c.allocationUsd ?? c.badDebtAtZeroUsd ?? 0
	const method =
		c.badDebtMarkets.length > 0
			? `Uses ${c.badDebtMarkets.length} market LLTV curve${c.badDebtMarkets.length === 1 ? '' : 's'}`
			: c.borrowedDebtUsd != null && c.liquidationThreshold != null
				? `Uses borrowed debt ${formatUsd(c.borrowedDebtUsd, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} and liquidation threshold ${Math.round(c.liquidationThreshold * 100)}%`
				: 'Uses modeled all-to-zero bad-debt ceiling'
	return (
		<span className="flex flex-col gap-1 text-secondary">
			<span className="flex flex-wrap items-center gap-x-3 gap-y-1">
				{onDropChange ? (
					<span className="relative flex h-3 w-full max-w-52 items-center">
						<span
							aria-hidden
							className="absolute inset-x-0 h-1 rounded-full"
							style={{ background: 'color-mix(in srgb, var(--bg-brand) 28%, transparent)' }}
						/>
						<input
							type="range"
							min={0}
							max={100}
							step={1}
							value={drop}
							onChange={(e) => onDropChange(Number(e.target.value))}
							aria-label={`Custom ${c.symbol} collateral price drop`}
							aria-valuetext={`${drop}% drop`}
							className={`absolute inset-0 w-full cursor-pointer appearance-none rounded-full bg-transparent outline-offset-4 outline-brand focus-visible:outline-2 ${SLIDER_THUMB}`}
						/>
					</span>
				) : null}
				<span className="text-primary tabular-nums">{`At ${dropLabel(drop)}:`}</span>
				<span aria-live="polite" className="min-w-0">
					{buffered ? (
						<span className={toneClasses('good').text}>no modeled bad debt</span>
					) : (
						<>
							{'est. bad debt up to '}
							<span className="label-md text-primary tabular-nums">{share(poolLoss)}</span>
							{' of deposit'}
							{yourShare != null
								? ` · ≈ ${formatUsd(yourShare, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} of yours`
								: null}
						</>
					)}
				</span>
			</span>
			<span className="body-sm text-tertiary">
				{`${method} · capped at allocation ${formatUsd(capUsd, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} · drag to set this asset's drop`}
			</span>
		</span>
	)
}

export function CollateralRow({
	c,
	explorers,
	cols,
	alloc,
	poolType,
	singleCollateral,
	supplyUsd,
	stressDrop,
	tuned,
	onStressDropChange,
	trustScope,
	markets
}: {
	c: CollateralVM
	explorers?: BlockExplorersResponse
	cols: string
	alloc: AllocationVM | null
	poolType: PoolType
	singleCollateral: boolean
	supplyUsd: number | null
	stressDrop: number
	tuned: boolean
	onStressDropChange?: (drop: number) => void
	trustScope?: Array<string>
	markets: Array<MarketOracle>
}) {
	const badge = oracleBadge(c.oracleType)
	const tone = toneClasses(badge.tone)
	const vendor = oracleVendorLabel(c)
	// On a one-collateral market the dollar figure is the whole story, so the share is dropped.
	const breakLossUsd = collateralMarketBreakLossUsd(c)
	const shareWord = poolType === 'market' ? 'of market' : 'of vault'
	const showBreakShare = !singleCollateral
	const breakLossSharePct = vaultSharePct(supplyUsd != null && supplyUsd > 0 ? breakLossUsd / supplyUsd : 0)
	const oracleExposure =
		c.drainableUsd != null && c.drainableUsd > 0
			? supplyUsd != null && supplyUsd > 0
				? vaultSharePct(c.drainableUsd / supplyUsd)
				: formatUsd(c.drainableUsd, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
			: null
	const aggregateTrust =
		c.aggregateTrustUsd > 0
			? formatUsd(c.aggregateTrustUsd, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
			: null
	const oc = c.oracleConfig
	const explorer = explorers
		? getBlockExplorerNew({
				apiResponse: explorers,
				address: c.address,
				chainName: c.chain,
				urlType: 'token'
			})
		: null
	const oracleAddrs = c.oracleAddresses.length > 0 ? c.oracleAddresses : oc?.oracle_address ? [oc.oracle_address] : []
	const oracleChain = oc?.chain ?? c.chain
	const oracleExplorerUrl = (addr: string): string | null =>
		explorers
			? (getBlockExplorerNew({ apiResponse: explorers, address: addr, chainName: oracleChain, urlType: 'address' })
					?.url ?? null)
			: null
	const capPct = c.supplyCapUsd && c.supplyCapUsd > 0 ? Math.min(100, (c.exposureUsd / c.supplyCapUsd) * 100) : null

	const allocFraction = alloc && alloc.totalUsd > 0 ? positionUsd(c) / alloc.totalUsd : null
	const allocText = allocFraction == null ? null : vaultSharePct(allocFraction)
	const rowMarkets = markets.filter((m) => m.collateral_asset?.address?.toLowerCase() === c.address.toLowerCase())
	const marketOracleUrl = (m: MarketOracle): string | null => {
		const coChain = m.collateral_asset?.chain ?? m.loan_asset?.chain
		return explorers && m.oracle_address && coChain
			? (getBlockExplorerNew({
					apiResponse: explorers,
					address: m.oracle_address,
					chainName: coChain,
					urlType: 'address'
				})?.url ?? null)
			: null
	}

	return (
		<details className="group smooth-disclosure border-t border-subtle first:border-t-0">
			<summary
				className={`flex cursor-pointer list-none flex-col gap-2 px-3 py-2.5 hover:bg-hover-row sm:grid sm:items-center sm:gap-6 ${cols}`}
			>
				<div className="flex items-center justify-between gap-2 sm:contents">
					<span className="flex min-w-0 items-center gap-2">
						<TokenLogo src={c.logoUrl} size={18} alt={c.symbol} />
						<BasicLink href={`/token/${slug(c.symbol)}`} className="truncate label-md text-primary hover:underline">
							{c.symbol}
						</BasicLink>
						<Tooltip content={c.oracleMechanism ?? badge.story} className="shrink-0">
							<span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 label-xs ${tone.chip}`}>
								<span className={`size-1.5 rounded-full ${tone.bar}`} aria-hidden />
								{badge.label}
							</span>
						</Tooltip>
						{c.ptPricing ? <PtPricingChip pricing={c.ptPricing} /> : null}
						{vendor ? <span className="hidden shrink-0 body-sm text-tertiary sm:inline">{vendor}</span> : null}
					</span>
					<span className="flex shrink-0 items-center gap-2 sm:hidden">
						<span className="flex flex-col items-end">
							<MarketBreakCell
								c={c}
								showShare={showBreakShare}
								shareWord={shareWord}
								sharePct={breakLossSharePct}
								variant="mobile"
							/>
							{oracleExposure ? (
								<span className="body-sm text-tertiary">{`Oracle exposure ${oracleExposure}`}</span>
							) : null}
						</span>
						<Icon name="chevron-down" className="size-3.5 text-secondary transition-transform group-open:rotate-180" />
					</span>
				</div>

				{alloc ? (
					<span className="hidden text-right label-md text-primary sm:block">
						{/* share first, amount under it — same rhythm as Market/Oracle Exposure */}
						{allocText ??
							(c.allocationUsd != null
								? formatUsd(c.allocationUsd, {
										compact: true,
										minimumCompactValue: 1_000_000,
										compactSuffix: 'lowercase'
									})
								: '—')}
						{allocText && c.allocationUsd != null ? (
							<span className="block body-sm whitespace-nowrap text-tertiary tabular-nums">
								{shareWord} ·{' '}
								{formatUsd(c.allocationUsd, {
									compact: true,
									minimumCompactValue: 1_000_000,
									compactSuffix: 'lowercase'
								})}
							</span>
						) : null}
					</span>
				) : null}

				<span className="hidden flex-col items-end sm:flex">
					<MarketBreakCell
						c={c}
						showShare={showBreakShare}
						shareWord={shareWord}
						sharePct={breakLossSharePct}
						variant="desktop"
					/>
				</span>

				<span className="hidden flex-col items-end sm:flex">
					<OracleExposureValue c={c} supplyUsd={supplyUsd} className="text-right" />
					{showBreakShare && oracleExposure ? <span className="body-sm text-tertiary">separate path</span> : null}
				</span>

				<Icon
					name="chevron-down"
					className="hidden size-3.5 text-secondary transition-transform group-open:rotate-180 sm:block"
				/>
			</summary>

			<div className="grid gap-x-8 gap-y-6 border-t border-subtle p-3 body-md sm:grid-cols-2 sm:p-4">
				<div className="flex min-w-0 flex-col gap-4">
					<h4 className={DETAIL_LABEL}>What it&apos;s made of</h4>

					<div className="flex flex-col gap-2.5 text-secondary">
						<span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
							<span className="text-primary">{badge.label}</span>
							{vendor ? <span className="text-primary">· {vendor}</span> : null}
							{c.feedKinds.length > 0 ? <span className="text-tertiary">({c.feedKinds.join(', ')})</span> : null}
							{c.ptPricing ? <PtPricingChip pricing={c.ptPricing} /> : null}
						</span>

						<p className="text-pretty text-primary">{c.oracleMechanism ?? badge.story}</p>

						{/* prefer the resolved on-chain legs (richest, launch-set only); else base/quote */}
						{c.oracleLegs?.length ? (
							<OracleLegs legs={c.oracleLegs} />
						) : (
							<OraclePricePath base={c.oracleBaseLeg} quote={c.oracleQuoteLeg} />
						)}

						{oc?.heartbeat_sec || oc?.deviation_threshold ? (
							<span className="body-sm text-tertiary">
								{[
									oc?.heartbeat_sec ? `Heartbeat ${Math.round(oc.heartbeat_sec / 3600)}h` : null,
									oc?.deviation_threshold ? `Deviation ${oc.deviation_threshold}bps` : null
								]
									.filter(Boolean)
									.join(' · ')}
							</span>
						) : null}

						{rowMarkets.length === 0 && oracleAddrs.length > 0 ? (
							<span className="flex flex-col gap-1.5">
								{oracleAddrs.map((addr) => (
									<AddressActions
										key={addr}
										address={addr}
										url={oracleExplorerUrl(addr)}
										label="oracle contract address"
									/>
								))}
							</span>
						) : null}
					</div>

					{rowMarkets.length > 0 ? (
						<div className="flex flex-col gap-2 border-t border-subtle pt-3">
							<span className="label-sm text-secondary">{`Markets this collateral backs · ${rowMarkets.length}`}</span>
							<ul className="flex flex-col gap-1.5 text-secondary">
								{rowMarkets.map((m) => {
									const mv = m.oracle_providers.filter(isProvenVendor).join(' / ')
									return (
										<li key={m.market_id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
											<span className="text-primary">→ {m.loan_asset?.symbol ?? 'loan'}</span>
											{m.lltv != null ? <span>{`${Math.round(m.lltv * 100)}% LLTV`}</span> : null}
											{m.oracle_address ? (
												<AddressActions
													address={m.oracle_address}
													url={marketOracleUrl(m)}
													label="market oracle address"
												/>
											) : (
												<span className="text-tertiary">no oracle</span>
											)}
											{mv ? <span className="body-sm text-tertiary">{mv}</span> : null}
										</li>
									)
								})}
							</ul>
						</div>
					) : null}

					<div className="flex flex-col gap-2 border-t border-subtle pt-3 text-secondary">
						{c.supplyCapUsd != null && capPct != null ? (
							<span>
								<span className="text-primary">Room to grow:</span>{' '}
								{`${formatUsd(c.exposureUsd, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} of ${formatUsd(c.supplyCapUsd, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} cap (${capPct < 1 ? '<1' : Math.round(capPct)}% used)`}
							</span>
						) : null}
						<span className="flex flex-wrap items-baseline gap-x-1.5">
							<Tooltip content={trustScopeTooltip(trustScope)} className="text-primary underline decoration-dotted">
								Aggregate Collateral Trust (ACT):
							</Tooltip>
							<span>{aggregateTrust ?? '—'}</span>
							{c.vaultCount > 0 ? <span className="body-sm text-tertiary">{`${c.vaultCount} vaults`}</span> : null}
						</span>
						<span className="flex flex-wrap items-center gap-x-1.5">
							<span className="text-primary">Token:</span>
							<AddressActions
								address={c.address}
								{...(explorer?.url ? { url: explorer.url } : {})}
								label={`${c.symbol} token address`}
							/>
						</span>
						{alloc && c.allocationUsd != null ? (
							<span className="sm:hidden">
								<span className="text-primary">Allocation:</span>{' '}
								{`${allocText ? `${allocText} of the vault · ` : ''}${formatUsd(c.allocationUsd, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`}
							</span>
						) : null}
					</div>
				</div>

				<div className="flex min-w-0 flex-col gap-4">
					<div className="flex items-center justify-between gap-2">
						<h4 className={DETAIL_LABEL}>If it breaks</h4>
						<span className="body-sm text-tertiary tabular-nums">
							{tuned ? dropLabel(stressDrop) : `${dropLabel(stressDrop)} default`}
						</span>
					</div>
					<div className="flex min-w-0 flex-col gap-2">
						<DepegWhatIf
							c={c}
							supplyUsd={supplyUsd}
							drop={stressDrop}
							{...(onStressDropChange ? { onDropChange: onStressDropChange } : {})}
						/>
					</div>
					{c.drainableUsd != null && c.drainableUsd > 0 ? (
						<span className="border-t border-subtle pt-3 text-secondary">
							<span className="text-primary">Oracle exposure:</span> {'up to '}
							<span className="text-primary">
								{supplyUsd != null && supplyUsd > 0
									? vaultSharePct(c.drainableUsd / supplyUsd)
									: formatUsd(c.drainableUsd, {
											compact: true,
											minimumCompactValue: 1_000_000,
											compactSuffix: 'lowercase'
										})}
							</span>
							{supplyUsd != null && supplyUsd > 0 ? ` ${shareWord}` : ''}
							{' drainable if the feed is compromised'}
							<span className="mt-1 block body-sm text-tertiary">
								separate path: an attacker borrows against a fake price
							</span>
						</span>
					) : null}
				</div>
			</div>
		</details>
	)
}

// Undeployed capital as a first-class row: no collateral, no bad-debt or oracle-hack path.
export function UnallocatedRow({ alloc, cols }: { alloc: AllocationVM; cols: string }) {
	const label = `Unallocated${
		alloc.idleUsd != null && alloc.idleUsd > 0
			? ` (incl. ${formatUsd(alloc.idleUsd, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} idle)`
			: ''
	}`
	return (
		<div
			className={`flex flex-col gap-1 border-t border-subtle px-3 py-2.5 text-secondary sm:grid sm:items-center sm:gap-6 ${cols}`}
		>
			<div className="flex items-center justify-between gap-2 sm:contents">
				<span className="flex min-w-0 flex-col">
					<span className="truncate body-md">{label}</span>
					<span className="hidden body-sm text-tertiary sm:block">
						not lent into any market — no collateral exposure
					</span>
				</span>
				<span className="body-md sm:hidden">
					{vaultSharePct(alloc.unallocatedPct / 100)} ·{' '}
					{formatUsd(alloc.unallocatedUsd, {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})}
				</span>
			</div>
			<span className="hidden text-right label-md text-primary sm:block">
				{vaultSharePct(alloc.unallocatedPct / 100)}
				<span className="block body-sm whitespace-nowrap text-tertiary tabular-nums">
					of vault ·{' '}
					{formatUsd(alloc.unallocatedUsd, {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})}
				</span>
			</span>
			<span className="hidden text-right body-md sm:flex sm:justify-end">—</span>
			<span className="hidden text-right body-md sm:flex sm:justify-end">—</span>
			<span className="hidden sm:block" />
		</div>
	)
}
