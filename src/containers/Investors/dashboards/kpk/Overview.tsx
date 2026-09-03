import { formatNumber } from '~/utils/numberFormat'
import { useKpkOverview } from './api'
import { CompositionSection } from './CompositionSection'
import { asOfLabel, ContinuityRule, LedgerStrip, LedgerTile, QueryError, RefLinks, usdFromMillions } from './ui'

export default function Overview() {
	const { data, isError } = useKpkOverview()

	if (isError) return <QueryError label="Overview" />

	const adjusted = data?.tvaAdjusted
	const asOf = asOfLabel(data?.asOf)

	return (
		<div className="flex flex-col gap-5">
			<LedgerStrip>
				<LedgerTile
					label="Total Value Allocated"
					value={data ? usdFromMillions(data.tva) : undefined}
					sub={`Current value KPK manages onchain${asOf ? ` · ${asOf}` : ''}`}
					metric={adjusted == null ? undefined : usdFromMillions(adjusted)}
					metricLabel={adjusted == null ? undefined : (data?.tvaAdjustedLabel ?? 'adjusted')}
					metricTitle={adjusted == null ? undefined : (data?.doubleCountNote ?? undefined)}
				/>
				{/* A guarded query that failed sends `null`, so the tile reads "—" while the
				    rest of the strip stands. A loading tile is the skeleton, not a dash. */}
				<LedgerTile
					label="Deployed onchain"
					value={data ? (data.deployedOnchain.value ?? '—') : undefined}
					suffix={data?.deployedOnchain.suffix}
					sub={data?.deployedOnchain.sub}
					metric={data ? (data.deployedOnchain.metric ?? '—') : undefined}
					metricLabel={data?.deployedOnchain.metricLabel}
				/>
				<LedgerTile
					label="Agent rebalancing volume"
					value={data ? (data.rebalancing.value ?? '—') : undefined}
					suffix={data?.rebalancing.suffix}
					sub={data?.rebalancing.sub}
					metric={data ? (data.rebalancing.metric ?? '—') : undefined}
					metricLabel={data?.rebalancing.metricLabel}
				/>
				<LedgerTile
					label="Funds lost"
					value={data ? formatNumber(data.fundsLost.value, { maximumFractionDigits: 0 }) : undefined}
					suffix={data ? `since ${data.fundsLost.since}` : undefined}
				>
					<ContinuityRule years={data?.fundsLost.years} />
				</LedgerTile>
			</LedgerStrip>

			<CompositionSection title="Composition of Total Value Allocated" comps={data?.comp} initialKey="line" />

			<RefLinks refs={data?.refs} />
		</div>
	)
}
