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

export function MetricStat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
	return (
		<Card padding="sm" border="subtle" className="flex min-w-0 flex-1 flex-col gap-1">
			<span className="label-sm text-secondary">{label}</span>
			<span className="font-jetbrains text-lg font-semibold">{value}</span>
			{sub != null ? <span className="label-sm text-secondary">{sub}</span> : null}
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
