import { useQuery } from '@tanstack/react-query'
import { lazy } from 'react'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { TabStatus } from '~/containers/Investors/TabStatus'
import { readInvestorApiJson } from '../../api.types'
import { buildFlareOverviewData, type OverviewAPIResponse } from './data'
import { ChartCard, KpiCard, SectionHeader } from './ui'

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

	if (query.error) return <TabStatus variant="error">Couldn't load the Flare overview.</TabStatus>
	if (!query.data) return <TabStatus variant="loading" />

	const { tvl, stables, fxrp, protocolRankings } = query.data

	return (
		<div className="flex flex-col gap-6">
			<SectionHeader>Chain Ecosystem</SectionHeader>
			<div className="grid grid-cols-2 gap-4">
				<KpiCard label="Chain TVL" value={tvl.currentFormatted} />
				{tvl.currentBridgedFormatted && <KpiCard label="Bridged TVL" value={tvl.currentBridgedFormatted} />}
			</div>
			<ChartCard title={tvl.title} subtitle={tvl.subtitle} titleTooltip={tvl.titleTooltip}>
				<MultiSeriesChart
					dataset={tvl.dataset}
					charts={tvl.charts}
					valueSymbol="$"
					title=""
					hideDefaultLegend={false}
					height="360px"
					chartOptions={tvl.chartOptions}
				/>
			</ChartCard>

			{protocolRankings.length > 0 && (
				<>
					<SectionHeader>Protocol Rankings</SectionHeader>
					<div className="overflow-x-auto rounded-lg border border-pro-cards-border bg-pro-cards-bg">
						<table className="w-full text-left text-sm">
							<thead>
								<tr className="border-b border-pro-cards-border text-sm font-medium tracking-wider text-pro-text-label uppercase">
									<th className="p-3">#</th>
									<th className="p-3">Protocol</th>
									<th className="p-3">Category</th>
									<th className="p-3 text-right">TVL</th>
									<th className="p-3 text-right">24h</th>
								</tr>
							</thead>
							<tbody>
								{protocolRankings.map((p, i) => (
									<tr key={p.name} className="border-b border-pro-cards-border last:border-b-0">
										<td className="p-3 text-pro-text-label">{i + 1}</td>
										<td className="p-3 font-medium text-pro-text-primary">
											<a
												href={p.url ?? undefined}
												target="_blank"
												rel="noopener noreferrer"
												className="flex items-center gap-2 hover:text-sl-accent"
											>
												{p.logo && <img src={p.logo} alt="" className="size-5 shrink-0 rounded-full" loading="lazy" />}
												{p.name}
											</a>
										</td>
										<td className="p-3 text-pro-text-label">{p.category ?? '-'}</td>
										<td className="p-3 text-right text-xs text-pro-text-primary tabular-nums">{p.tvlFormatted}</td>
										<td
											className={`p-3 text-right text-xs tabular-nums ${p.change24h >= 0 ? 'text-success' : 'text-error'}`}
										>
											{p.change24hFormatted}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</>
			)}

			{fxrp && (
				<>
					<SectionHeader>FXRP</SectionHeader>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
						<KpiCard label="Total FXRP Supply" value={fxrp.totalFxrpSupply} />
						<KpiCard
							label="% Locked in DeFi"
							value={fxrp.pctLockedInDefi}
							sub="All networks"
							def="Share of total FXRP supply deployed in DeFi, across all networks, not just Flare."
						/>
						<KpiCard
							label="Value Locked in DeFi"
							value={fxrp.valueLockedInDefiUsd}
							sub="Flare only"
							def="FXRP deployed in DeFi on Flare only. Can exceed Flare's chain TVL, which excludes liquid staking, bridges and vault-on-vault positions."
						/>
					</div>
				</>
			)}

			<SectionHeader>Stablecoins</SectionHeader>
			<div className="grid grid-cols-3 gap-4">
				<KpiCard label="Total" value={stables.kpis.total} />
				<KpiCard label="Native Minted" value={stables.kpis.native} />
				<KpiCard label="Bridged" value={stables.kpis.bridged} />
			</div>

			<ChartCard title={stables.title} subtitle="Stablecoin supply circulating on Flare: native-minted vs. bridged.">
				<MultiSeriesChart
					dataset={stables.dataset}
					charts={stables.charts}
					valueSymbol="$"
					title=""
					solidChartAreaStyle
					height="360px"
					chartOptions={stables.chartOptions}
				/>
			</ChartCard>
		</div>
	)
}
