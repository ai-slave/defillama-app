import type { ReactNode } from 'react'
import { PercentChange } from '~/components/PercentChange'
import { Card } from '~/ui/Card'
import { materialChange, toPercent } from './utils'

/** Fractional change rendered as a signed, coloured percent. */
export function ChangeCell({ fraction }: { fraction: number | null | undefined }) {
	const pct = toPercent(fraction ?? null)
	if (pct == null) return <span className="text-tertiary">–</span>
	return <PercentChange percent={pct} />
}

export function MaterialChangeCell({
	current,
	previous
}: {
	current: number | null | undefined
	previous: number | null | undefined
}) {
	const change = materialChange(current, previous)
	if (change.kind === 'unavailable') return <span className="text-tertiary">–</span>
	if (change.kind === 'new') {
		return (
			<span className="label-sm text-secondary" title="No previous value was recorded">
				New
			</span>
		)
	}
	if (change.kind === 'insufficient-baseline') {
		return (
			<span className="label-xs text-tertiary" title="The previous value is too small for a meaningful comparison">
				Insufficient baseline
			</span>
		)
	}
	return <ChangeCell fraction={change.fraction} />
}

/** One label/value pair inside a MetricStatStrip (summary-strip recipe — see design.md). */
export function MetricStat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
	return (
		<div className="flex items-baseline gap-1.5">
			<span className="body-md text-secondary">{label}</span>
			<span className="mono-md-bold">{value}</span>
			{sub != null ? <span className="body-sm">{sub}</span> : null}
		</div>
	)
}

/** Single-card inline stats strip that MetricStat pairs live in. */
export function MetricStatStrip({ children, surface = true }: { children: ReactNode; surface?: boolean }) {
	const content = <div className="flex w-full flex-wrap items-center gap-x-5 gap-y-1.5">{children}</div>
	return surface ? <Card padding="strip">{content}</Card> : content
}

/** Funding rate with positive/negative coloring. */
export function FundingCell({ rate }: { rate: number | null | undefined }) {
	if (rate == null) return <span className="text-tertiary">–</span>
	const pct = rate * 100
	const colorClass = pct > 0 ? 'text-data-up' : pct < 0 ? 'text-data-down' : ''
	return <span className={colorClass}>{pct.toFixed(4)}%</span>
}
