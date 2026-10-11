import { useRouter } from 'next/router'
import { Fragment, type ReactNode } from 'react'
import { useBlockExplorers } from '~/api/client'
import { Hovercard } from '~/ui/Hovercard'
import { Icon } from '~/ui/Icon'
import { RelativeTime } from '~/ui/RelativeTime'
import { Tooltip } from '~/ui/Tooltip'
import { formatRatio, formatUsd, formatPercent, USD_LOWERCASE_MILLIONS_OPTIONS } from '~/utils/numberFormat'
import { exitWithdrawableUsd, withdrawableFraction } from '../data/exit'
import { getDepegWarningSeverity, hasPart } from '../domain/apyPresentation'
import {
	EXIT_TONE_CLASS,
	exitCoverageLine,
	exitFeeWarning,
	exitHeadline,
	exitStatusLine,
	exitTone
} from '../domain/exitPresentation'
import { InstantTooltip } from '../InstantTooltip'
import { EXIT_STATUS_ID } from '../poolDetail/ExitReliabilityPanel'
import { YIELD_PERCENT_OPTIONS } from '../poolDetail/format'
import { HOW_WE_VERIFY_ID } from '../poolDetail/VerifiedApyPanel'
import { useSubscribeProModal } from '../useSubscribeProModal'
import { useVerifiedAccess } from '../useVerifiedAccess'
import { tokenIconByAddress } from '../VaultRisk/tokenIcon'
import { buildApyCardRows, pct } from './apyCardRows'
import { ExitStatusIcon } from './ExitStatusIcon'
import { MeasuredCard, MeasuredExitOffer, MeasuredLock, MeasuredSeal } from './Measured'
import type { IYieldTableRow } from './types'

// APY column headers name their window when it deviates from the default latest
// snapshot, so the numbers stay self-documenting outside the controls' viewport.
export function ApyWindowHeader({ label }: { label: string }) {
	const { query } = useRouter()
	const window = typeof query.apyWindow === 'string' ? query.apyWindow : undefined
	const suffix = window === 'avg_7d' ? ' (7d)' : window === 'avg_30d' ? ' (30d)' : ''
	return <>{`${label}${suffix}`}</>
}

// --- formatting helpers -------------------------------------------------------------------

type SignMode = 'plus' | 'minus' | 'auto'

function signedPct(value: number, signed?: SignMode): string {
	if (signed === 'plus') return `+${formatPercent(Math.abs(value), YIELD_PERCENT_OPTIONS)}`
	if (signed === 'minus') return `-${formatPercent(Math.abs(value), YIELD_PERCENT_OPTIONS)}`
	if (signed === 'auto') return `${value >= 0 ? '+' : ''}${formatPercent(value, YIELD_PERCENT_OPTIONS)}`
	return formatPercent(value, YIELD_PERCENT_OPTIONS)
}

// The single, shared "no data" marker used across every yields table cell. A plain inline em
// dash tinted --text-disabled — it carries NO alignment of its own, so the column's `align`
// meta (applied as text-align on the <td>) places it exactly where that column's real content
// sits: centered columns center the dash, end-aligned columns right-align it. An explicit dash
// (never a blank cell) reads as "no data" rather than a rendering bug.
// Missing values render as truly empty cells (the site-wide convention) — no dash.
export function EmptyCell() {
	return null
}

// Always-on depeg warning shown next to the earn APY value. A pool's underlying USD stablecoin
// off peg by >=5% (relative) shows an amber alert-triangle; >=10% escalates to red — because the
// reported APY may not reflect realizable returns. Deviation is RELATIVE (−0.05 = −5%).
export function DepegWarningIcon({
	deviation,
	symbol,
	consequence = 'the reported APY may not reflect realizable returns'
}: {
	deviation: number | null | undefined
	symbol: string | null | undefined
	// Per-surface tail of the tooltip: earn warns about the yield, borrow/loop about the asset.
	consequence?: string | undefined
}) {
	if (deviation == null) return null
	const severity = getDepegWarningSeverity(deviation)
	if (!severity) return null
	const abs = Math.abs(deviation)
	const colorClass = severity === 'danger' ? 'text-error' : 'text-warning'
	const token = symbol ?? 'The underlying stablecoin'
	const content = `${token} is ${formatPercent(abs, { input: 'fraction', minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false })} off peg — ${consequence}.`
	return (
		<Tooltip content={content}>
			<Icon name="alert-triangle-filled" className={`size-5 shrink-0 ${colorClass}`} />
		</Tooltip>
	)
}

// Supply-cap fill bar under the TVL value, shown only for pools that cap
// deposits — same bar vocabulary as the borrow table's AvailableCell.
// fill = tvl / (tvl + available), clamped at 100% (caps can be exceeded
// onchain via interest accrual).
export function SupplyCapBar({ tvl, available }: { tvl: number | null; available: number }) {
	if (tvl == null) return null
	const fill = Math.min(tvl / (tvl + available), 1)
	const full = available === 0
	const label = full
		? 'No capacity for new deposits — pool is at its supply cap'
		: `${formatUsd(available, { compact: true, compactSuffix: 'lowercase' })} can still be deposited — supply cap is ~${formatPercent(fill, { input: 'fraction', maximumFractionDigits: 0 })} utilized`
	return (
		<InstantTooltip content={label} className="ml-auto w-fit max-w-full justify-end">
			<span
				role="img"
				aria-label={label}
				className="hidden h-1 w-20 overflow-hidden rounded-full bg-surface-elevated-2 md:block"
			>
				<span
					className={`block h-full rounded-full ${full ? 'bg-error' : 'bg-brand'}`}
					style={{ width: `${fill * 100}%` }}
				/>
			</span>
		</InstantTooltip>
	)
}

// --- earn APY cell -------------------------------------------------------------------------
// Neutral total (the column header is the category) over a composition sub-line that renders
// only the non-null resolved-view components: base (secondary), +reward% (amber), +intrinsic%
// (secondary). A label/value tooltip mirrors the components with a bordered Total row; when a
// token filter supplies a median, the tooltip appends a "vs median" pp-delta row.

// Quiet explainer for a null APY under the current toggles when the pool has
// components the view excludes — distinguishes "nothing for this lens" from
// "no data at all" (which stays a bare empty cell).
function ComponentsOnlyHint({ label }: { label: string }) {
	return <span className="block text-right body-sm text-tertiary">{label}</span>
}

/**
 * A component rather than a bare hook call, so the dialog store exists only for the handful of
 * locked rows on a page. `children` renders the cell's whole layout, putting the modal beside it
 * rather than inside the hovercard or the flex row — see `useSubscribeProModal`.
 */
function LockedCell({ placement, children }: { placement: string; children: (onUpgrade: () => void) => ReactNode }) {
	const { show, modal } = useSubscribeProModal('verified-yields', placement)
	return (
		<>
			{children(show)}
			{modal}
		</>
	)
}

/** Public embedded tables cannot serve measurements, but must not upsell a reader who owns them. */
function useVerifiedLockedForReader(verifiedLocked: boolean | undefined): boolean {
	const { isDenied } = useVerifiedAccess()
	return verifiedLocked === true && isDenied
}

export interface EarnApyMedian {
	/** Display name of the filtered set the median describes: a token symbol or 'selection'. */
	label: string
	apy: number
}

export function EarnApyCell({ row, median }: { row: IYieldTableRow; median: EarnApyMedian | undefined }) {
	const resolved = row.resolvedApy
	// Gated server-side: a locked row is computed entirely from the reported figures, with
	// `verifiedLocked` in place of every measured field. The cell renders that decision, never
	// makes it, so nothing here can disagree with the sort.
	const locked = useVerifiedLockedForReader(row.verifiedLocked)
	const total = row.apy
	const measured = row.verifiedApy ?? null
	// A measured leg of either kind puts our reading in the headline; the seal says so.
	const measuredIntrinsic = row.verifiedIntrinsicApy ?? null
	const headlineMeasured = measured != null || measuredIntrinsic != null
	if (total == null) {
		if (row.apyRewardRaw != null) return <ComponentsOnlyHint label="reward only" />
		if (row.intrinsicSourceSymbol) return <ComponentsOnlyHint label="intrinsic only" />
		return <EmptyCell />
	}

	const base = resolved?.base ?? row.apyBase ?? null
	const reward = resolved?.reward ?? row.apyReward ?? null
	const intrinsic = resolved?.intrinsic ?? null
	const hasComposition = hasPart(reward) || hasPart(intrinsic)

	// A measured pool always opens a card, locked or not: the seal and the padlock both have to be
	// explainable.
	const showCard = row.verified != null || locked || hasComposition || median != null

	// Filled seal = measured; muted = this window isn't; padlock = measured but withheld. The mark
	// trails the figure; an unmarked row keeps the slot so every figure shares one right edge.
	const glyph = locked ? (
		<MeasuredLock size="size-3.25" className="text-tertiary" />
	) : row.verified || measuredIntrinsic != null ? (
		<MeasuredSeal muted={!headlineMeasured} />
	) : (
		<span className="w-[13px] shrink-0" aria-hidden />
	)
	const body = (
		<span className="grid grid-cols-[1fr_auto] items-center justify-items-end gap-x-1.5 leading-tight">
			<span className="title-md text-primary">
				<span className={showCard ? 'underline decoration-dotted' : undefined}>{pct(total)}</span>
			</span>
			{glyph}
			{hasComposition ? (
				<span className="col-start-1 row-start-2 flex gap-1 body-sm whitespace-nowrap">
					{base != null ? <span className="text-secondary">{pct(base)}</span> : null}
					{hasPart(reward) ? <span className="text-(--yield-reward-text)">+{pct(reward)}</span> : null}
					{hasPart(intrinsic) ? <span className="text-secondary">+{pct(intrinsic)}</span> : null}
				</span>
			) : null}
		</span>
	)

	const depeg = <DepegWarningIcon deviation={row.pegDeviation} symbol={row.pegTokenSymbol} />

	const row_ = (content: ReactNode) => (
		<span className="ml-auto flex w-fit max-w-full items-center justify-end gap-1">
			{depeg}
			{content}
		</span>
	)

	if (!showCard) return row_(body)

	// Formatting the full hovercard breakdown is unnecessary for the overwhelmingly common plain
	// cell. Keep it off the row-render hot path until a card will actually be mounted.
	const symbols = (row.rewardTokensSymbols ?? []).filter(Boolean)
	const cardInput = {
		total,
		base,
		reward,
		intrinsic,
		symbols,
		intrinsicSourceSymbol: row.intrinsicSourceSymbol,
		measured,
		unsubstitutedMeasured: row.verifiedUnsubstitutedApy ?? null,
		lastVerified: row.verifiedLastApy ?? null,
		measuredIntrinsic,
		locked,
		median
	}
	const cardRows = buildApyCardRows(cardInput)

	// One anchor, one card, so nothing in the cell competes for the cursor.
	const anchored = (onUpgrade?: () => void) => (
		<Hovercard
			contentClassName="p-3"
			placement="right-start"
			content={
				<MeasuredCard
					rows={cardRows}
					verified={row.verified}
					measured={headlineMeasured}
					unsubstitutedMeasured={row.verifiedUnsubstitutedApy != null}
					poolUrl={`/yields/pool/${row.configID}#${HOW_WE_VERIFY_ID}`}
					{...(onUpgrade ? { offer: { poolName: row.pool, onUpgrade } } : {})}
				/>
			}
		>
			{body}
		</Hovercard>
	)

	if (locked) return <LockedCell placement="apy-cell">{(onUpgrade) => row_(anchored(onUpgrade))}</LockedCell>
	return row_(anchored())
}

// --- measured exit cell --------------------------------------------------------------------
// What actually happened when we simulated a real holder withdrawing, onchain, yesterday.
// Status carries a leading glyph so the four outcomes are distinguishable at a glance without
// reading; only `blocked` is colored, because it is the only outcome that is bad news on its
// own (a queue with a known ETA is a fact, not a warning).
//
// A measured exit FEE rides along as the table's standard warning triangle — the same glyph
// depeg and exploit flags use — since it is money out of the holder's pocket either way.

export function ExitCell({ row }: { row: IYieldTableRow }) {
	const locked = useVerifiedLockedForReader(row.verifiedLocked)
	// Its own card: both columns sell one subscription but answer different questions.
	if (locked) {
		return (
			<LockedCell placement="exit-cell">
				{(onUpgrade) => (
					<Hovercard
						contentClassName="p-3"
						placement="right-start"
						content={
							<span className="flex w-80 max-w-(--popover-available-width) flex-col">
								<MeasuredExitOffer poolName={row.pool} onUpgrade={onUpgrade} />
							</span>
						}
					>
						<span className="flex items-center gap-1.5 text-secondary">
							<span className="underline decoration-dotted">•••</span>
							<MeasuredLock size="size-3.25" className="text-tertiary" />
						</span>
					</Hovercard>
				)}
			</LockedCell>
		)
	}
	const verified = row.verified
	// No measurement is not a claim that exit is bad — it renders like every other missing value.
	if (!verified?.exit) return <EmptyCell />
	const exit = verified.exit

	// An unknown status must not fall through to "Blocked".
	const label = exitHeadline(verified, { compact: true })
	if (label == null) return <EmptyCell />

	const feeWarning = exitFeeWarning(exit.fee_bps)
	const share = withdrawableFraction(verified)
	const withdrawableUsd = exitWithdrawableUsd(verified)
	const depositsUsd = verified.tvl?.usd ?? null
	// The bar is the cell's ring unrolled: color is the withdrawable share, filling from the left
	// under the figure that names it. Both figures are needed; with either missing, the coverage
	// line states what IS known and never draws a zero.
	const showFigures = share != null && withdrawableUsd != null && depositsUsd != null
	const note = exitCoverageLine(verified)
	const toneClass = EXIT_TONE_CLASS[exitTone(verified)]

	// A hovercard rather than a tooltip: the footer links out to the pool page's exit ledger.
	return (
		<Hovercard
			contentClassName="p-3"
			placement="right-start"
			content={
				<span className="flex w-80 max-w-(--popover-available-width) flex-col gap-2 text-left body-sm">
					{/* The status is the headline, its stamp beside it as in the APY card; the line itself is the
					    APY card's exit footer, so the two never word one fact differently. */}
					<span className="flex items-center justify-between gap-3">
						<span className="flex items-center gap-1.5 font-medium text-primary">
							<ExitStatusIcon verified={verified} />
							{exitStatusLine(verified)}
						</span>
						{exit.as_of ? (
							<RelativeTime value={exit.as_of} prefix="measured" className="shrink-0 text-tertiary" />
						) : null}
					</span>
					{showFigures ? (
						<>
							<span
								className="block h-1 w-full overflow-hidden rounded-full"
								style={{ backgroundColor: 'var(--border-medium)' }}
								aria-hidden
							>
								<span
									className={`block h-full rounded-full ${toneClass}`}
									style={{
										width: `${share * 100}%`,
										minWidth: share > 0 ? 1 : undefined,
										backgroundColor: 'currentColor'
									}}
								/>
							</span>
							<span className="flex justify-between gap-3 text-secondary tabular-nums">
								<span className="whitespace-nowrap">
									<span className="font-medium text-primary">
										{formatUsd(withdrawableUsd, USD_LOWERCASE_MILLIONS_OPTIONS)}
									</span>{' '}
									withdrawable now
								</span>
								<span className="whitespace-nowrap">
									of{' '}
									<span className="font-medium text-primary">
										{formatUsd(depositsUsd, USD_LOWERCASE_MILLIONS_OPTIONS)}
									</span>{' '}
									deposits
								</span>
							</span>
						</>
					) : null}
					{note ? <span className="text-secondary">{note}</span> : null}
					{feeWarning ? (
						<span className="flex items-start gap-1.5 text-warning">
							<span className="flex h-lh shrink-0 items-center">
								<Icon name="alert-triangle" className="size-3" />
							</span>
							{feeWarning}
						</span>
					) : null}
					<span className="flex items-center justify-end border-t border-subtle pt-2">
						<a
							href={`/yields/pool/${row.configID}#${EXIT_STATUS_ID}`}
							data-umami-event="yields-verified-evidence-click"
							data-umami-event-source="exit"
							className="shrink-0 whitespace-nowrap text-link hover:underline"
						>
							Evidence →
						</a>
					</span>
				</span>
			}
		>
			<span className="flex flex-col items-end leading-tight whitespace-nowrap">
				<span className="flex items-center gap-1.5">
					<ExitStatusIcon verified={verified} />
					{/* The value inherits the table's text like every other column; the icon carries the tone. */}
					<span className="underline decoration-dotted">{label}</span>
					{feeWarning ? <Icon name="alert-triangle" className="size-3 shrink-0 text-warning" /> : null}
				</span>
				{withdrawableUsd != null ? (
					<span className="text-secondary">{formatUsd(withdrawableUsd, USD_LOWERCASE_MILLIONS_OPTIONS)}</span>
				) : null}
			</span>
		</Hovercard>
	)
}

// --- neutral total APY cell ----------------------------------------------------------------
// Borrow markets Supply/Borrow APY and routes/loops Supply/Borrow APY. The total numeral is
// NEUTRAL (the column header names the category — color doctrine: only Net/Looped are signed).
// When the row carries the resolved-view leg components, a composition sub-line renders beneath
// the total — base (secondary) · reward (amber) · intrinsic (secondary) — and a label/value
// tooltip with a bordered summary row appears.
// `kind` only flavors the reward sign + labels (borrow reward offsets cost → shown negative).

export interface TotalApyParts {
	base?: number | null
	reward?: number | null
	intrinsic?: number | null
}

export function TotalApyCell({
	value,
	parts,
	kind = 'supply',
	rewardSymbols,
	intrinsicSource
}: {
	value: number | null | undefined
	parts?: TotalApyParts
	kind?: 'supply' | 'borrow'
	rewardSymbols?: Array<string>
	intrinsicSource?: string | null
}) {
	if (value == null) return <EmptyCell />

	const base = parts?.base ?? null
	const reward = parts?.reward ?? null
	const intrinsic = parts?.intrinsic ?? null
	const hasComposition = hasPart(reward) || hasPart(intrinsic)
	const rewardSign: SignMode = kind === 'borrow' ? 'minus' : 'plus'
	const symbols = (rewardSymbols ?? []).filter(Boolean)

	const tipRows: Array<SignedTipRow> = []
	const baseLabel = kind === 'borrow' ? 'Base cost' : 'Base'
	// Inside a breakdown the base line always shows: a null base contributes 0.00% to the
	// served total, and the rows must visibly sum to it. (The cell value itself keeps the
	// null-renders-empty contract — these rows only exist when the total exists.)
	if (base != null) tipRows.push({ label: baseLabel, value: base })
	if (hasPart(reward)) {
		tipRows.push({
			label: symbols.length > 0 ? `Reward · ${symbols.join(', ')}` : 'Reward',
			value: reward,
			signed: rewardSign
		})
	}
	if (hasPart(intrinsic)) {
		tipRows.push({
			label: intrinsicSource ? `Intrinsic · ${intrinsicSource}` : 'Intrinsic',
			value: intrinsic,
			signed: 'plus'
		})
	}
	// A tooltip is worth showing whenever there is a real breakdown to reveal — any non-base
	// component (reward/intrinsic) present, even on its own. A lone base row carries nothing
	// beyond the cell numeral, so it stays tooltip-less. This mirrors EarnApyCell; the previous
	// `length > 1` gate wrongly suppressed the tooltip for intrinsic-only supply cells (borrow
	// collateral whose base leg is null, e.g. wstETH earning only its stETH staking yield).
	const showTooltip = hasComposition

	const body = (
		<span className="flex flex-col items-end leading-tight">
			<span className="flex items-center justify-end label-md text-primary">
				<span className={showTooltip ? 'underline decoration-dotted' : undefined}>
					{formatPercent(value, YIELD_PERCENT_OPTIONS)}
				</span>
			</span>
			{hasComposition ? (
				<span className="flex gap-1 body-sm">
					{base != null ? <span className="text-secondary">{formatPercent(base, YIELD_PERCENT_OPTIONS)}</span> : null}
					{hasPart(reward) ? <span className="text-(--yield-reward-text)">{signedPct(reward, rewardSign)}</span> : null}
					{hasPart(intrinsic) ? (
						<span className="text-secondary">+{formatPercent(intrinsic, YIELD_PERCENT_OPTIONS)}</span>
					) : null}
				</span>
			) : null}
		</span>
	)

	if (!showTooltip) return body

	return (
		<Hovercard
			placement="right-start"
			className="max-w-full"
			contentClassName="p-3"
			content={
				<span className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1 whitespace-nowrap">
					{tipRows.map((tip) => (
						<Fragment key={tip.label}>
							<span className="text-secondary">{tip.label}</span>
							<span className="text-right text-primary">{signedPct(tip.value, tip.signed)}</span>
						</Fragment>
					))}
					<span className="mt-0.5 border-t border-subtle pt-1.5 text-secondary">
						{kind === 'borrow' ? 'Cost' : 'Total'}
					</span>
					<span className="mt-0.5 border-t border-subtle pt-1.5 text-right label-sm">
						{formatPercent(value, YIELD_PERCENT_OPTIONS)}
					</span>
				</span>
			}
		>
			{body}
		</Hovercard>
	)
}

// A bold, top-bordered total row in the tooltip grid — label spans the first two columns (label +
// multiple), value in the third.
function SummaryRow({ label, value }: { label: string; value: string }) {
	return (
		<>
			<span className="col-span-2 mt-0.5 border-t border-subtle pt-1.5 label-sm text-primary">{label}</span>
			<span className="mt-0.5 border-t border-subtle pt-1.5 text-right label-sm text-primary">{value}</span>
		</>
	)
}

// --- signed APY cell -----------------------------------------------------------------------
// Routes Net APY + loops Looped APY: the only columns where the sign genuinely flips, so they
// carry signed color (teal positive / red negative), per the color doctrine. The breakdown
// tooltip uses a 3-col label/multiple/value grid, a top note row, and a top-bordered summary
// row. Because the flat route/loop rows carry only leg TOTALS (no base/reward/intrinsic
// contributions or per-leg multipliers), the rows are the supply/borrow leg totals and the
// multiple column is blank.

export type SignedTipRow = { label: string; value: number; signed?: SignMode; multiple?: number }

export function SignedApyCell({
	value,
	tooltipRows,
	summaryLabel,
	note
}: {
	value: number | null | undefined
	tooltipRows?: Array<SignedTipRow>
	summaryLabel?: string
	note?: string
}) {
	if (value == null) return <EmptyCell />

	const tone =
		value > 0.005 ? 'text-(--yield-positive-text)' : value < -0.005 ? 'text-(--yield-negative-text)' : 'text-secondary'

	const hasBreakdown = !!tooltipRows && tooltipRows.length > 0

	const body = (
		<span className="flex items-center justify-end">
			<span className={`label-md ${tone} ${hasBreakdown ? 'underline decoration-dotted' : ''}`.trim()}>
				{value >= 0 ? '+' : ''}
				{formatPercent(value, YIELD_PERCENT_OPTIONS)}
			</span>
		</span>
	)

	if (!hasBreakdown) return body

	return (
		<Hovercard
			placement="right-start"
			className="max-w-full"
			contentClassName="max-w-96 p-3"
			content={
				<span className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-4 gap-y-1 whitespace-nowrap">
					{note ? (
						<span className="col-span-3 mb-0.5 border-b border-subtle pb-1.5 text-center text-secondary">{note}</span>
					) : null}
					{tooltipRows.map((tip) => (
						<Fragment key={tip.label}>
							<span className="text-secondary">{tip.label}</span>
							<span className="text-right body-sm text-tertiary">
								{tip.multiple != null ? `${formatRatio(tip.multiple)}x` : ''}
							</span>
							<span className="text-right text-primary">{signedPct(tip.value, tip.signed)}</span>
						</Fragment>
					))}
					{summaryLabel ? <SummaryRow label={summaryLabel} value={signedPct(value, 'auto')} /> : null}
				</span>
			}
		>
			{body}
		</Hovercard>
	)
}

// --- available (borrow capacity) cell ------------------------------------------------------
// `$available` primary over a thin MUTED single-color bar encoding utilization. No threshold
// color flip and no caption — the exact "N% utilized" figure lives in the hover tooltip only.

export function AvailableCell({
	available,
	capacityFilled
}: {
	available: number | null | undefined
	capacityFilled: number | null | undefined
}) {
	if (available == null) return <EmptyCell />

	const filledPct = capacityFilled != null ? Math.max(0, Math.min(100, capacityFilled * 100)) : null

	const body = (
		<span className="flex flex-col items-end gap-1">
			<span className="text-primary">
				{formatUsd(available, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
			</span>
			{filledPct != null ? (
				<span className="hidden h-1 w-20 overflow-hidden rounded-full bg-surface-elevated-2 md:block">
					<span className="block h-full rounded-full bg-brand" style={{ width: `${filledPct}%` }} />
				</span>
			) : null}
		</span>
	)

	if (filledPct == null) return body

	// `w-fit ml-auto` shrinks the tooltip anchor to the value+bar block and right-aligns it in the
	// cell, so the (centered, placement='top') tooltip centers over the content rather than the full
	// cell width — otherwise the anchor spans the whole right-aligned cell and the tooltip drifts left.
	return (
		<InstantTooltip
			content={`${formatPercent(filledPct, { input: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false })} utilized`}
			className="ml-auto w-fit max-w-full justify-end"
		>
			{body}
		</InstantTooltip>
	)
}

// Reward-column cell: token logos (icon service keyed by evm chain id + address, resolved
// through the block-explorers directory like VaultRisk) beside the raw window reward.
// Icons render only when the chain resolves and the image loads — no broken placeholders.
export function RewardApyCell({
	value,
	chain,
	tokens
}: {
	value: number | null | undefined
	chain: string | undefined
	tokens: Array<{ address: string; symbol: string | null }> | undefined
}) {
	const { data: explorers } = useBlockExplorers()
	if (value == null) return <EmptyCell />
	const icons = (tokens ?? [])
		.slice(0, 3)
		.map((token) => ({
			src: chain && token.address ? tokenIconByAddress(explorers, chain, token.address, 48) : null,
			symbol: token.symbol
		}))
		.filter((icon): icon is { src: string; symbol: string | null } => icon.src != null)
	return (
		<span className="flex items-center justify-end gap-1.5">
			{icons.length > 0 ? (
				<span className="flex items-center">
					{icons.map((icon, i) => (
						<img
							key={icon.src}
							src={icon.src}
							alt={icon.symbol ?? ''}
							width={22}
							height={22}
							loading="lazy"
							className={`rounded-full ${i > 0 ? '-ml-2' : ''}`}
							onError={(e) => {
								;(e.currentTarget as HTMLImageElement).style.display = 'none'
							}}
						/>
					))}
				</span>
			) : null}
			<span>{formatPercent(value, YIELD_PERCENT_OPTIONS)}</span>
		</span>
	)
}
