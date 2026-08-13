import { formatNumber } from '~/utils/numberFormat'
import { useKpkOverview, type KpkOverviewCompKey } from './api'
import { CompositionSection } from './CompositionSection'
import { ContinuityRule, LedgerStrip, LedgerTile, NoticeBanner, QueryError, RefLinks, usdFromMillions } from './ui'

const BREAKDOWNS = [
	{ key: 'line', label: 'By line' },
	{ key: 'denom', label: 'By denomination' },
	{ key: 'chain', label: 'By chain' },
	{ key: 'protocol', label: 'By protocol' }
] as const satisfies ReadonlyArray<{ key: KpkOverviewCompKey; label: string }>

export default function Overview() {
	const { data, isError } = useKpkOverview()

	if (isError) return <QueryError label="Overview" />

	return (
		<div className="flex flex-col gap-5">
			{data?.notice && <NoticeBanner>{data.notice}</NoticeBanner>}

			<LedgerStrip>
				<LedgerTile
					label="Total Value Allocated"
					value={data ? usdFromMillions(data.tva) : undefined}
					sub="Current value KPK manages onchain"
				/>
				<LedgerTile
					label="Deployed onchain"
					value={data?.deployedOnchain.value}
					suffix={data?.deployedOnchain.suffix}
					sub={data?.deployedOnchain.sub}
					metric={data?.deployedOnchain.metric}
					metricLabel={data?.deployedOnchain.metricLabel}
				/>
				<LedgerTile
					label="Agent rebalancing volume"
					value={data?.rebalancing.value}
					suffix={data?.rebalancing.suffix}
					sub={data?.rebalancing.sub}
					metric={data?.rebalancing.metric}
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

			<CompositionSection
				title="Composition of Total Value Allocated"
				comps={data?.comp}
				options={BREAKDOWNS}
				initialKey="line"
			/>

			<RefLinks refs={data?.refs} />
		</div>
	)
}
