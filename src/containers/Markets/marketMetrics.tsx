import type { ReactNode } from 'react'
import { PercentChange } from '~/components/PercentChange'
import { Card } from '~/ui/Card'
import { toPercent } from './utils'

/** Fractional change rendered as a signed, coloured percent. */
export function ChangeCell({ fraction }: { fraction: number | null | undefined }) {
	const pct = toPercent(fraction ?? null)
	if (pct == null) return <span className="text-tertiary">–</span>
	return <PercentChange percent={pct} />
}

/** One label/value pair inside a MetricStatStrip (summary-strip recipe — see design.md). */
export function MetricStat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
	return (
		<div className="flex items-baseline gap-1.5">
			<span className="body-sm text-secondary">{label}</span>
			<span className="font-jetbrains label-md tabular-nums">{value}</span>
			{sub != null ? <span className="body-sm">{sub}</span> : null}
		</div>
	)
}

/** Single-card inline stats strip that MetricStat pairs live in. */
export function MetricStatStrip({ children }: { children: ReactNode }) {
	return (
		<Card padding="sm" border="subtle" className="flex w-full flex-wrap items-center gap-x-5 gap-y-1.5">
			{children}
		</Card>
	)
}

/** Funding rate with positive/negative coloring. */
export function FundingCell({ rate }: { rate: number | null | undefined }) {
	if (rate == null) return <span className="text-tertiary">–</span>
	const pct = rate * 100
	const colorClass = pct > 0 ? 'text-data-up' : pct < 0 ? 'text-data-down' : ''
	return <span className={colorClass}>{pct.toFixed(4)}%</span>
}
