import { formatPercent } from '~/utils/numberFormat'

export function NarrativeCallout({ children }: { children: React.ReactNode }) {
	return (
		<div
			className="rounded-lg border border-subtle bg-surface p-4 pl-5 body-md text-secondary"
			style={{ borderLeft: '3px solid #FF7A1A' }}
		>
			{children}
		</div>
	)
}

export function formatPct(n: number, decimals = 2): string {
	if (!Number.isFinite(n)) return '-'
	return `${formatPercent(n, { input: 'percent', minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: false })}`
}
