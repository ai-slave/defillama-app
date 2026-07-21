import { useQuery } from '@tanstack/react-query'
import { lazy, useEffect } from 'react'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { useContentReady } from '~/containers/Investors/ContentReadyContext'
import { readInvestorApiJson } from '../../api.types'
import { buildFlareStakingData, type StakingAPIResponse } from './data'
import { ChartCard, KpiCard, NarrativeCallout, SectionHeader } from './ui'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

export default function Staking() {
	const query = useQuery({
		queryKey: ['flare-staking'],
		queryFn: async () => {
			const res = await fetch('/api/public/flare/staking')
			if (!res.ok) throw new Error(`Flare staking API error: ${res.status}`)
			return buildFlareStakingData(await readInvestorApiJson<StakingAPIResponse>(res))
		},
		staleTime: 10 * 60 * 1000,
		refetchOnWindowFocus: false
	})

	const onContentReady = useContentReady()

	useEffect(() => {
		if (query.data) onContentReady()
	}, [query.data, onContentReady])

	if (!query.data) return null

	const k = query.data.kpis
	const chart = query.data.chart

	return (
		<div className="flex flex-col gap-6">
			{query.data.narrative && <NarrativeCallout>{query.data.narrative}</NarrativeCallout>}

			<SectionHeader>Staking &amp; Delegation</SectionHeader>
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
				<KpiCard label="% of Circ. Supply Staked or Delegated" value={k.pctStakedOrDelegated} />
				<KpiCard label="FTSO Delegation" value={k.ftsoDelegated} sub={k.ftsoDelegatedUsd} />
				<KpiCard label="Total Stake" value={k.totalStake} />
				<KpiCard label="Validators" value={k.validatorCount} />
				<KpiCard label="Avg Uptime" value={k.averageUptime} />
			</div>

			{chart && chart.dataset.source.length > 0 && (
				<ChartCard title={chart.title}>
					<div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-pro-text-label">
						{chart.seriesNames.map((name) => (
							<span key={name} className="flex items-center gap-1.5">
								<span className="size-2.5 rounded-full" style={{ backgroundColor: chart.colors[name] }} />
								{name}
							</span>
						))}
					</div>
					<MultiSeriesChart
						dataset={chart.dataset}
						charts={chart.charts}
						valueSymbol=""
						title=""
						height="360px"
						chartOptions={chart.chartOptions}
					/>
					{chart.subtitle && <p className="mt-2 text-xs leading-relaxed text-pro-text-label">{chart.subtitle}</p>}
				</ChartCard>
			)}
		</div>
	)
}
