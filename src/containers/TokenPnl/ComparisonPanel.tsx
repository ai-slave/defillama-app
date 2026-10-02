import { Card } from '~/ui/Card'
import { formatUsd, formatCompactNumber } from '~/utils/numberFormat'
import { formatPnlPercent } from './format'
import type { ComparisonEntry } from './types'

export function ComparisonPanel({ entries, activeId }: { entries: Array<ComparisonEntry>; activeId: string }) {
	if (entries.length === 0) return null
	return (
		<Card padding="md" as="section" aria-label="Range comparison">
			<div className="mb-3 flex items-center justify-between gap-2">
				<h3 className="heading-xs">Range Comparison</h3>
				<p className="body-xs text-secondary">BTC · ETH · SOL</p>
			</div>
			<ul className="grid gap-3 sm:grid-cols-3">
				{entries.map((entry) => {
					const isPositive = entry.percentChange >= 0
					const absChange = formatCompactNumber(Math.abs(entry.absoluteChange), {
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})
					return (
						<li
							key={`${entry.id}-range-comparison`}
							className={`flex flex-col gap-1 rounded-lg border border-subtle p-3 transition-colors duration-200 ${
								entry.id === activeId ? 'bg-surface-elevated-1' : 'bg-surface'
							}`}
						>
							<div className="flex items-center gap-2">
								{entry.image ? (
									<img src={entry.image} alt={entry.name} width={20} height={20} className="rounded-full" />
								) : null}
								<span className="label-sm text-primary uppercase">{entry.symbol}</span>
							</div>
							<p className={`${isPositive ? 'text-data-up' : 'text-data-down'} mono-xl`}>
								{formatPnlPercent(entry.percentChange)}
							</p>
							<p className="body-xs text-secondary">{`${isPositive ? '+$' : '-$'}${absChange}`}</p>
							<p className="body-xs text-secondary">{`${formatUsd(entry.startPrice, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} → ${formatUsd(entry.endPrice, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`}</p>
						</li>
					)
				})}
			</ul>
		</Card>
	)
}
