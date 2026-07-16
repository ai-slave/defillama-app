import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { Fragment } from 'react'
import { fetchBlockExplorers } from '~/api'
import { Icon } from '~/components/Icon'
import { Hovercard } from '~/ui/Hovercard'
import { Tooltip } from '~/ui/Tooltip'
import { formattedNum } from '~/utils'
import { getDepegWarningSeverity, hasPart } from '../domain/apyPresentation'
import { InstantTooltip } from '../InstantTooltip'
import { fmtPct } from '../poolDetail/format'
import { tokenIconByAddress } from '../VaultRisk/tokenIcon'
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
	if (signed === 'plus') return `+${fmtPct(Math.abs(value))}%`
	if (signed === 'minus') return `-${fmtPct(Math.abs(value))}%`
	if (signed === 'auto') return `${value >= 0 ? '+' : ''}${fmtPct(value)}%`
	return `${fmtPct(value)}%`
}

// The single, shared "no data" marker used across every yields table cell. A plain inline em
// dash tinted --text-disabled — it carries NO alignment of its own, so the column's `align`
// meta (applied as text-align on the <td>) places it exactly where that column's real content
// sits: centered columns centre the dash, end-aligned columns right-align it. An explicit dash
// (never a blank cell) reads as "no data" rather than a rendering bug.
// Missing values render as truly empty cells (the site-wide convention) — no dash.
export function EmptyCell() {
	return null
}

// Always-on depeg warning shown next to the earn APY value. A pool's underlying USD stablecoin
// off peg by >=5% (relative) shows an amber alert-triangle; >=10% escalates to red — because the
// advertised APY may not reflect realizable returns. Deviation is RELATIVE (−0.05 = −5%).
export function DepegWarningIcon({
	deviation,
	symbol,
	consequence = 'the advertised APY may not reflect realizable returns'
}: {
	deviation: number | null | undefined
	symbol: string | null | undefined
	// Per-surface tail of the tooltip: earn warns about the yield, borrow/loop about the asset.
	consequence?: string
}) {
	if (deviation == null) return null
	const severity = getDepegWarningSeverity(deviation)
	if (!severity) return null
	const abs = Math.abs(deviation)
	const colorClass = severity === 'danger' ? 'text-data-down' : 'text-warning'
	const token = symbol ?? 'The underlying stablecoin'
	const content = `${token} is ${(abs * 100).toFixed(1)}% off peg — ${consequence}.`
	return (
		<Tooltip content={content}>
			<Icon name="alert-triangle" height={14} width={14} className={`shrink-0 ${colorClass}`} />
		</Tooltip>
	)
}

// --- earn APY cell -------------------------------------------------------------------------
// Neutral total (the column header is the category) over a composition sub-line that renders
// only the non-null resolved-view components: base (secondary), +reward% (amber), +intrinsic%
// (secondary). A label/value tooltip mirrors the components with a bordered Total row.

// Quiet explainer for a null APY under the current toggles when the pool has
// components the view excludes — distinguishes "nothing for this lens" from
// "no data at all" (which stays a bare empty cell).
function ComponentsOnlyHint({ label }: { label: string }) {
	return <span className="block text-right body-sm text-tertiary">{label}</span>
}

export function EarnApyCell({ row }: { row: IYieldTableRow }) {
	const resolved = row.resolvedApy
	const total = row.apy
	if (total == null) {
		if (row.apyRewardRaw != null) return <ComponentsOnlyHint label="reward only" />
		if (row.intrinsicSourceSymbol) return <ComponentsOnlyHint label="intrinsic only" />
		return <EmptyCell />
	}

	const base = resolved?.base ?? row.apyBase ?? null
	const reward = resolved?.reward ?? row.apyReward ?? null
	const intrinsic = resolved?.intrinsic ?? null
	const hasComposition = hasPart(reward) || hasPart(intrinsic)
	const symbols = (row.rewardTokensSymbols ?? []).filter(Boolean)

	const tipRows: Array<{ label: string; value: number }> = []
	if (base != null) tipRows.push({ label: 'Base', value: base })
	if (hasPart(reward)) {
		tipRows.push({ label: symbols.length ? `Reward · ${symbols.join(', ')}` : 'Reward', value: reward })
	}
	if (hasPart(intrinsic)) {
		const src = row.intrinsicSourceSymbol
		tipRows.push({ label: src ? `Intrinsic · ${src}` : 'Intrinsic', value: intrinsic })
	}

	const showTooltip = tipRows.length > 0

	const body = (
		<span className="flex flex-col items-end leading-tight">
			<span className="flex items-center gap-1 text-sm font-bold text-primary">
				<span>
					{fmtPct(total)}
					<span className="ml-0.5 opacity-70">%</span>
				</span>
			</span>
			{hasComposition ? (
				<span className="flex gap-1 body-sm">
					{base != null ? <span className="text-secondary">{fmtPct(base)}%</span> : null}
					{hasPart(reward) ? <span className="text-(--yield-reward-text)">+{fmtPct(reward)}%</span> : null}
					{hasPart(intrinsic) ? <span className="text-secondary">+{fmtPct(intrinsic)}%</span> : null}
				</span>
			) : null}
		</span>
	)

	const depeg = <DepegWarningIcon deviation={row.pegDeviation} symbol={row.pegTokenSymbol} />

	if (!showTooltip) {
		return (
			<span className="ml-auto flex w-fit max-w-full items-center justify-end gap-1">
				{depeg}
				{body}
			</span>
		)
	}

	return (
		<span className="ml-auto flex w-fit max-w-full items-center justify-end gap-1">
			{depeg}
			<Hovercard
				className="w-fit"
				contentClassName="p-3"
				content={
					<span className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1 whitespace-nowrap">
						{tipRows.map((tip) => (
							<Fragment key={tip.label}>
								<span className="text-secondary">{tip.label}</span>
								<span className="text-right text-primary">{fmtPct(tip.value)}%</span>
							</Fragment>
						))}
						<span className="mt-0.5 border-t border-subtle pt-1.5 text-secondary">Total</span>
						<span className="mt-0.5 border-t border-subtle pt-1.5 text-right font-semibold">{fmtPct(total)}%</span>
					</span>
				}
			>
				{body}
			</Hovercard>
		</span>
	)
}

// --- neutral total APY cell ----------------------------------------------------------------
// Borrow markets Supply/Borrow APY and routes/loops Supply/Borrow APY. The total numeral is
// NEUTRAL (the column header names the category — color doctrine: only Net/Looped are signed).
// When the row carries the resolved-view leg components, a composition sub-line renders beneath
// the total — base (secondary) · reward (amber) · intrinsic (secondary) — and a label/value
// tooltip with a bordered summary row appears.
// `kind` only flavours the reward sign + labels (borrow reward offsets cost → shown negative).

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
	rewardSymbols?: string[]
	intrinsicSource?: string | null
}) {
	if (value == null) return <EmptyCell />

	const base = parts?.base ?? null
	const reward = parts?.reward ?? null
	const intrinsic = parts?.intrinsic ?? null
	const hasComposition = hasPart(reward) || hasPart(intrinsic)
	const rewardSign: SignMode = kind === 'borrow' ? 'minus' : 'plus'
	const symbols = (rewardSymbols ?? []).filter(Boolean)

	const tipRows: SignedTipRow[] = []
	const baseLabel = kind === 'borrow' ? 'Base cost' : 'Base'
	// Inside a breakdown the base line always shows: a null base contributes 0.00% to the
	// served total, and the rows must visibly sum to it. (The cell value itself keeps the
	// null-renders-empty contract — these rows only exist when the total exists.)
	if (base != null) tipRows.push({ label: baseLabel, value: base })
	if (hasPart(reward)) {
		tipRows.push({
			label: symbols.length ? `Reward · ${symbols.join(', ')}` : 'Reward',
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
	const showTooltip = tipRows.length > 0

	const body = (
		<span className="flex flex-col items-end leading-tight">
			<span className="flex items-center justify-end label-md text-primary">
				{fmtPct(value)}
				<span className="ml-0.5 opacity-70">%</span>
			</span>
			{hasComposition ? (
				<span className="flex gap-1 body-sm">
					{base != null ? <span className="text-secondary">{fmtPct(base)}%</span> : null}
					{hasPart(reward) ? <span className="text-(--yield-reward-text)">{signedPct(reward, rewardSign)}</span> : null}
					{hasPart(intrinsic) ? <span className="text-secondary">+{fmtPct(intrinsic)}%</span> : null}
				</span>
			) : null}
		</span>
	)

	if (!showTooltip) return body

	return (
		<Hovercard
			className="ml-auto w-fit max-w-full justify-end"
			contentClassName="p-3"
			content={
				<span className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1 whitespace-nowrap">
					{tipRows.map((tip) => (
						<Fragment key={tip.label}>
							<span className="text-secondary">{tip.label}</span>
							<span className="text-right text-primary">{signedPct(tip.value, tip.signed)}</span>
						</Fragment>
					))}
					<>
						<span className="mt-0.5 border-t border-subtle pt-1.5 text-secondary">
							{kind === 'borrow' ? 'Cost' : 'Total'}
						</span>
						<span className="mt-0.5 border-t border-subtle pt-1.5 text-right label-sm">{fmtPct(value)}%</span>
					</>
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
	tooltipRows?: SignedTipRow[]
	summaryLabel?: string
	note?: string
}) {
	if (value == null) return <EmptyCell />

	const tone =
		value > 0.005 ? 'text-(--yield-positive-text)' : value < -0.005 ? 'text-(--yield-negative-text)' : 'text-secondary'

	const body = (
		<span className="flex items-center justify-end">
			<span className={`label-md ${tone}`}>
				{value >= 0 ? '+' : ''}
				{fmtPct(value)}
				<span className="ml-0.5 opacity-70">%</span>
			</span>
		</span>
	)

	if (!tooltipRows || tooltipRows.length === 0) return body

	return (
		<Hovercard
			className="ml-auto w-fit max-w-full justify-end"
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
								{tip.multiple != null ? `${tip.multiple.toFixed(2)}x` : ''}
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
// `$available` primary over a thin MUTED single-color bar encoding utilisation. No threshold
// color flip and no caption — the exact "N% filled" figure lives in the hover tooltip only.

export function AvailableCell({
	available,
	capacityFilled
}: {
	available: number | null | undefined
	capacityFilled: number | null | undefined
}) {
	if (available == null) return <EmptyCell />

	const pct = capacityFilled != null ? Math.max(0, Math.min(100, capacityFilled * 100)) : null

	const body = (
		<span className="flex flex-col items-end gap-1">
			<span className="text-primary">{formattedNum(available, true)}</span>
			{pct != null ? (
				<span className="hidden h-1 w-20 overflow-hidden rounded-full bg-surface-elevated-2 md:block">
					<span className="block h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
				</span>
			) : null}
		</span>
	)

	if (pct == null) return body

	// `w-fit ml-auto` shrinks the tooltip anchor to the value+bar block and right-aligns it in the
	// cell, so the (centered, placement='top') tooltip centers over the content rather than the full
	// cell width — otherwise the anchor spans the whole right-aligned cell and the tooltip drifts left.
	return (
		<InstantTooltip content={`${pct.toFixed(1)}% filled`} className="ml-auto w-fit max-w-full justify-end">
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
	const { data: explorers } = useQuery({
		queryKey: ['block-explorers'],
		queryFn: fetchBlockExplorers,
		staleTime: 24 * 60 * 60 * 1000
	})
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
			{icons.length ? (
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
			<span>{fmtPct(value)}%</span>
		</span>
	)
}
