import { useQuery } from '@tanstack/react-query'
import { lazy } from 'react'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import { TabStatus } from '~/containers/Investors/TabStatus'
import { StatTile } from '~/ui/SummaryStats'
import { readInvestorApiJson } from '../../api.types'
import { buildFlareFAssetsData, type FAssetsAPIResponse } from './data'
import { ChartCard, NarrativeCallout, SectionHeader } from './ui'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>
const PieChart = lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>

export default function FAssets() {
	const query = useQuery({
		queryKey: ['flare-fassets'],
		queryFn: async () => {
			const res = await fetch('/api/public/flare/fAssets')
			if (!res.ok) throw new Error(`Flare fAssets API error: ${res.status}`)
			return buildFlareFAssetsData(await readInvestorApiJson<FAssetsAPIResponse>(res))
		},
		staleTime: 10 * 60 * 1000,
		refetchOnWindowFocus: false
	})

	if (query.error) return <TabStatus variant="error">Couldn't load Flare FAssets data.</TabStatus>
	if (!query.data) return <TabStatus variant="loading" />

	const k = query.data.kpis
	const charts = query.data.charts

	return (
		<div className="flex flex-col gap-6">
			{query.data.narrative && <NarrativeCallout>{query.data.narrative}</NarrativeCallout>}

			<SectionHeader>FXRP</SectionHeader>
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				<StatTile label="Total FXRP Supply" value={k.totalFxrpSupply} />
				<StatTile
					label="% Locked in DeFi"
					value={k.pctLockedInDefi}
					sub="All networks"
					tooltip="Share of total FXRP supply deployed in DeFi, across all networks, not just Flare."
				/>
				<StatTile
					label="Value Locked in DeFi"
					value={k.valueLockedInDefiUsd}
					sub="Flare only"
					tooltip="FXRP deployed in DeFi on Flare only. Can exceed Flare's chain TVL, which excludes liquid staking, bridges and vault-on-vault positions."
				/>
				<StatTile
					label="FXRP Locked in DeFi"
					value={k.fxrpLockedInDefi}
					sub="Flare only"
					tooltip="Same figure as Value Locked in DeFi, in FXRP token units instead of USD."
				/>
			</div>

			{charts.locked && (
				<ChartCard
					title={charts.locked.title}
					subtitle={charts.locked.subtitle}
					titleTooltip={charts.locked.titleTooltip}
				>
					<MultiSeriesChart
						dataset={charts.locked.dataset}
						charts={charts.locked.charts}
						valueSymbol=""
						title=""
						height="360px"
						chartOptions={charts.locked.chartOptions}
					/>
				</ChartCard>
			)}

			<div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
				{charts.dist && (
					<ChartCard title={charts.dist.title} subtitle={charts.dist.subtitle} titleTooltip={charts.dist.titleTooltip}>
						<PieChart
							chartData={charts.dist.data}
							stackColors={charts.dist.colors}
							radius={['45%', '72%']}
							showLegend
							legendPosition={{
								orient: 'vertical',
								left: 'right',
								top: 'middle'
							}}
							valueSymbol="$"
							title=""
							height="360px"
						/>
					</ChartCard>
				)}

				{charts.allNetworksDist && (
					<ChartCard
						title={charts.allNetworksDist.title}
						subtitle={charts.allNetworksDist.subtitle}
						titleTooltip={charts.allNetworksDist.titleTooltip}
					>
						<PieChart
							chartData={charts.allNetworksDist.data}
							stackColors={charts.allNetworksDist.colors}
							radius={['45%', '72%']}
							showLegend
							legendPosition={{
								orient: 'vertical',
								left: 'right',
								top: 'middle'
							}}
							valueSymbol="$"
							title=""
							height="360px"
						/>
					</ChartCard>
				)}
			</div>

			<SectionHeader>Activity</SectionHeader>
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
				<StatTile label="Total DeFi Txns" value={k.totalDefiTransactions} />
				<StatTile
					label="Total Minters"
					value={k.totalMinters}
					tooltip="Distinct wallets with DeFi activity in FXRP protocols, not a count of mint transactions."
				/>
				<StatTile label="Mints" value={k.mintCount} />
				<StatTile label="Burns" value={k.burnCount} tooltip="FXRP redemptions." />
				<StatTile label="Swaps" value={k.swapCount} />
			</div>
		</div>
	)
}
