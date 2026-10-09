import { useQuery } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { ChartPanelExportShellFallback } from '~/ui/ChartPanel'
import { PanelStatus, PanelLoadingStatus } from '~/ui/Status'
import { StatTile } from '~/ui/SummaryStats'
import { queryReadFailed } from '~/utils/query'
import { readInvestorApiJson } from '../../api.types'
import { buildFlareStakingData, type StakingAPIResponse } from './data'
import { ChartCard, NarrativeCallout, SectionHeader } from './ui'

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

	// A failed refresh of data already shown keeps it; the error and its Try again replace the tab only before data loads.
	if (queryReadFailed(query) && !query.data)
		return (
			<PanelStatus variant="error" retry={query}>
				Couldn't load Flare staking data.
			</PanelStatus>
		)
	if (!query.data) return <PanelLoadingStatus />

	const k = query.data.kpis
	const chart = query.data.chart
	const pctChart = query.data.pctChart

	return (
		<div className="flex flex-col gap-6">
			{query.data.narrative && <NarrativeCallout>{query.data.narrative}</NarrativeCallout>}

			<SectionHeader>Staking &amp; Delegation</SectionHeader>
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
				<StatTile
					label="% of Circ. Supply Staked or Delegated"
					value={k.pctStakedOrDelegated}
					tooltip="P-chain staked FLR plus FTSO-delegated WFLR, as a percent of circulating supply."
				/>
				{k.totalStakedOrDelegated && (
					<StatTile
						label="Total Staked + Delegated"
						value={k.totalStakedOrDelegated}
						tooltip="Sum of P-chain staking and FTSO delegation, the height of the stacked chart below."
					/>
				)}
				<StatTile
					label="FTSO Delegation"
					value={k.ftsoDelegated}
					sub={k.ftsoDelegatedUsd}
					tooltip="WFLR delegated to Flare's decentralized price oracle providers, instead of staked to a validator."
				/>
				<StatTile
					label="Total Stake"
					value={k.totalStake}
					tooltip="FLR staked to P-chain validators. Doesn't include FTSO delegation."
				/>
				<StatTile label="Validators" value={k.validatorCount} />
				<StatTile label="Avg Uptime" value={k.averageUptime} />
			</div>

			{chart && chart.dataset.source.length > 0 && (
				<ChartCard title={chart.title} titleTooltip={chart.titleTooltip}>
					<div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 body-sm text-secondary">
						{chart.seriesNames.map((name) => (
							<span key={name} className="flex items-center gap-1.5">
								<span className="size-2.5 rounded-full" style={{ backgroundColor: chart.colors[name] }} />
								{name}
							</span>
						))}
					</div>
					<Suspense fallback={<ChartPanelExportShellFallback />}>
						<MultiSeriesChart
							dataset={chart.dataset}
							charts={chart.charts}
							valueSymbol=""
							title=""
							height="360px"
							chartOptions={chart.chartOptions}
						/>
					</Suspense>
					{chart.subtitle && <p className="mt-2 body-sm text-secondary">{chart.subtitle}</p>}
				</ChartCard>
			)}

			{pctChart && (
				<ChartCard
					title={pctChart.title ?? '% of Circulating Supply Staked or Delegated'}
					subtitle={pctChart.subtitle}
					titleTooltip={pctChart.titleTooltip}
				>
					<Suspense fallback={<ChartPanelExportShellFallback style={{ minHeight: '340px' }} />}>
						<MultiSeriesChart
							dataset={pctChart.dataset}
							charts={pctChart.charts}
							valueSymbol="%"
							title=""
							height="300px"
							chartOptions={pctChart.chartOptions}
						/>
					</Suspense>
				</ChartCard>
			)}
		</div>
	)
}
