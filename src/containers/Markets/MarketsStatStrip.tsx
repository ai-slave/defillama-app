import { Card } from '~/ui/Card'
import { formattedNum } from '~/utils'
import { type Segment, segmentHasOi } from './segments'
import { MaterialChangeCell } from './shared'
import type { SymbolStat } from './types'
import { segmentTotals, sentimentCounts, TOP_N, topSymbols } from './utils'

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
	return (
		<div className="flex min-w-0 flex-col gap-0.5">
			<span className="body-md text-secondary">{label}</span>
			<span className="mono-md-bold">{value}</span>
			{sub != null ? <span className="body-sm text-tertiary">{sub}</span> : null}
		</div>
	)
}

export function MarketsStatStrip({ rows, segment }: { rows: SymbolStat[]; segment: Segment }) {
	const totals = segmentTotals(rows)
	const hasOi = segmentHasOi(segment)
	const counts = sentimentCounts(topSymbols(rows, 'volume', TOP_N), segment)

	return (
		<Card padding="strip" className="grid grid-cols-2 gap-x-6 gap-y-3 lg:grid-cols-4">
			<Stat
				label="24h Volume"
				value={totals.volume_24h == null ? '–' : formattedNum(totals.volume_24h, true)}
				sub={<MaterialChangeCell current={totals.volume_24h} previous={totals.volume_prev_24h} />}
			/>
			{hasOi ? (
				<Stat
					label="Open Interest"
					value={totals.oi_usd == null ? '–' : formattedNum(totals.oi_usd, true)}
					sub={<MaterialChangeCell current={totals.oi_usd} previous={totals.oi_prev_usd} />}
				/>
			) : null}
			<Stat
				label="Assets"
				value={formattedNum(totals.asset_count)}
				sub={`${formattedNum(totals.market_count)} markets`}
			/>
			<Stat
				label="Sentiment (top 100)"
				value={
					<>
						<span className="text-data-up">{counts.rising} rising</span>
						<span className="text-tertiary"> · </span>
						<span className="text-data-down">{counts.fading} fading</span>
					</>
				}
				sub={`${counts.churn} churn · ${counts.building} building · ${counts.flat} flat`}
			/>
		</Card>
	)
}
