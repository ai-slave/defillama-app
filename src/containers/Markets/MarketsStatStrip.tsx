import { Card } from '~/ui/Card'
import { formattedNum } from '~/utils'
import { type Segment, segmentHasOi } from './segments'
import { MaterialChangeCell, StripStat } from './shared'
import type { SymbolStat } from './types'
import { segmentTotals, sentimentCounts, TOP_N, topSymbols } from './utils'

export function MarketsStatStrip({ rows, segment }: { rows: SymbolStat[]; segment: Segment }) {
	const totals = segmentTotals(rows)
	const hasOi = segmentHasOi(segment)
	const counts = sentimentCounts(topSymbols(rows, 'volume', TOP_N), segment)

	return (
		<Card padding="strip" className="grid grid-cols-2 gap-x-6 gap-y-3 lg:grid-cols-4">
			<StripStat
				label="24h Volume"
				value={totals.volume_24h == null ? '–' : formattedNum(totals.volume_24h, true)}
				sub={<MaterialChangeCell current={totals.volume_24h} previous={totals.volume_prev_24h} />}
			/>
			{hasOi ? (
				<StripStat
					label="Open Interest"
					value={totals.oi_usd == null ? '–' : formattedNum(totals.oi_usd, true)}
					sub={<MaterialChangeCell current={totals.oi_usd} previous={totals.oi_prev_usd} />}
				/>
			) : null}
			<StripStat
				label="Assets"
				value={formattedNum(totals.asset_count)}
				sub={`${formattedNum(totals.market_count)} markets`}
			/>
			<StripStat
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
