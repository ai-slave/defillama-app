import { useQuery } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { Card } from '~/ui/Card'
import { CHART_FILL, ChartPanelExportShellLoading } from '~/ui/ChartPanel'
import { Panel } from '~/ui/Panel'
import { PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import { StatTile } from '~/ui/SummaryStats'
import { queryReadFailed } from '~/utils/query'
import { readInvestorApiJson } from '../../api.types'
import { buildFlareOverviewData, type OverviewAPIResponse } from './data'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

export default function Overview() {
	const query = useQuery({
		queryKey: ['flare-overview'],
		queryFn: async () => {
			const res = await fetch('/api/public/flare/overview')
			if (!res.ok) throw new Error(`Flare overview API error: ${res.status}`)
			return buildFlareOverviewData(await readInvestorApiJson<OverviewAPIResponse>(res))
		},
		staleTime: 10 * 60 * 1000,
		refetchOnWindowFocus: false
	})

	// A failed refresh of data already shown keeps it; the error and its Try again replace the tab only before data loads.
	if (queryReadFailed(query))
		return (
			<PanelStatus variant="error" retry={query}>
				Couldn't load the Flare overview.
			</PanelStatus>
		)
	if (!query.data) return <PanelLoadingStatus />

	const { tvl, stables, fxrp, protocolRankings } = query.data

	return (
		<div className="flex flex-col gap-6">
			<h2 className="heading-xs">Chain ecosystem</h2>
			<div className="grid grid-cols-2 gap-4">
				<StatTile label="Chain TVL" value={tvl.currentFormatted} />
				{tvl.currentBridgedFormatted && <StatTile label="Bridged TVL" value={tvl.currentBridgedFormatted} />}
			</div>
			<Panel>
				<Suspense fallback={<ChartPanelExportShellLoading />}>
					<MultiSeriesChart
						dataset={tvl.dataset}
						charts={tvl.charts}
						valueSymbol="$"
						title={tvl.title}
						subtitle={tvl.subtitle}
						titleTooltip={tvl.titleTooltip}
						headingAs="h3"
						containerClassName={CHART_FILL}
						showLegend
						chartOptions={tvl.chartOptions}
					/>
				</Suspense>
			</Panel>

			{protocolRankings.length > 0 && (
				<>
					<h2 className="heading-xs">Protocol rankings</h2>
					<Card padding="none" className="overflow-x-auto">
						<table className="w-full text-left body-md">
							<thead>
								<tr className="border-b border-subtle label-md tracking-wider text-secondary uppercase">
									<th className="p-3">#</th>
									<th className="p-3">Protocol</th>
									<th className="p-3">Category</th>
									<th className="p-3 text-right">TVL</th>
									<th className="p-3 text-right">24h</th>
								</tr>
							</thead>
							<tbody>
								{protocolRankings.map((p, i) => (
									<tr key={p.name} className="border-b border-subtle last:border-b-0">
										<td className="p-3 text-secondary">{i + 1}</td>
										<td className="p-3 font-medium text-primary">
											<a
												href={p.url ?? undefined}
												target="_blank"
												rel="noopener noreferrer"
												className="flex items-center gap-2 hover:text-link"
											>
												{p.logo && <img src={p.logo} alt="" className="size-5 shrink-0 rounded-full" loading="lazy" />}
												{p.name}
											</a>
										</td>
										<td className="p-3 text-secondary">{p.category ?? '-'}</td>
										<td className="p-3 text-right body-sm text-primary tabular-nums">{p.tvlFormatted}</td>
										<td
											className={`p-3 text-right body-sm tabular-nums ${p.change24h >= 0 ? 'text-success' : 'text-error'}`}
										>
											{p.change24hFormatted}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</Card>
				</>
			)}

			{fxrp && (
				<>
					<h2 className="heading-xs">FXRP</h2>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
						<StatTile label="Total FXRP Supply" value={fxrp.totalFxrpSupply} />
						<StatTile
							label="% Locked in DeFi"
							value={fxrp.pctLockedInDefi}
							sub="All networks"
							tooltip="Share of total FXRP supply deployed in DeFi, across all networks, not just Flare."
						/>
						<StatTile
							label="Value Locked in DeFi"
							value={fxrp.valueLockedInDefiUsd}
							sub="Flare only"
							tooltip="FXRP deployed in DeFi on Flare only. Can exceed Flare's chain TVL, which excludes liquid staking, bridges and vault-on-vault positions."
						/>
					</div>
				</>
			)}

			<h2 className="heading-xs">Stablecoins</h2>
			<div className="grid grid-cols-3 gap-4">
				<StatTile label="Total" value={stables.kpis.total} />
				<StatTile label="Native Minted" value={stables.kpis.native} />
				<StatTile label="Bridged" value={stables.kpis.bridged} />
			</div>

			<Panel>
				<Suspense fallback={<ChartPanelExportShellLoading />}>
					<MultiSeriesChart
						dataset={stables.dataset}
						charts={stables.charts}
						valueSymbol="$"
						title={stables.title}
						subtitle="Stablecoin supply circulating on Flare: native-minted vs bridged."
						headingAs="h3"
						containerClassName={CHART_FILL}
						solidChartAreaStyle
						chartOptions={stables.chartOptions}
					/>
				</Suspense>
			</Panel>
		</div>
	)
}
