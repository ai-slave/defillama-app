import { useQuery } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { ChartPanelExportShellLoading } from '~/ui/ChartPanel'
import { Panel } from '~/ui/Panel'
import { PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import { StatTile } from '~/ui/SummaryStats'
import { queryReadFailed } from '~/utils/query'
import { readInvestorApiJson } from '../../api.types'
import { buildFlareStakingData, type StakingAPIResponse } from './data'
import { NarrativeCallout } from './ui'

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
	if (queryReadFailed(query))
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

			<h2 className="heading-xs">Staking &amp; delegation</h2>
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
				<Panel>
					<Suspense fallback={<ChartPanelExportShellLoading />}>
						<MultiSeriesChart
							dataset={chart.dataset}
							charts={chart.charts}
							valueSymbol=""
							title={chart.title}
							subtitle={chart.subtitle}
							titleTooltip={chart.titleTooltip}
							headingAs="h3"
							showLegend
							chartOptions={chart.chartOptions}
						/>
					</Suspense>
				</Panel>
			)}

			{pctChart && (
				<Panel>
					<Suspense fallback={<ChartPanelExportShellLoading />}>
						<MultiSeriesChart
							dataset={pctChart.dataset}
							charts={pctChart.charts}
							valueSymbol="%"
							title={pctChart.title ?? '% of Circulating Supply Staked or Delegated'}
							subtitle={pctChart.subtitle}
							titleTooltip={pctChart.titleTooltip}
							headingAs="h3"
							chartOptions={pctChart.chartOptions}
						/>
					</Suspense>
				</Panel>
			)}
		</div>
	)
}
