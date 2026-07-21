import { useQuery } from '@tanstack/react-query'
import { lazy, useEffect } from 'react'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import { useContentReady } from '~/containers/Investors/ContentReadyContext'
import { readInvestorApiJson } from '../../api.types'
import { buildFlareFAssetsData, type FAssetsAPIResponse } from './data'
import { ChartCard, KpiCard, NarrativeCallout, SectionHeader } from './ui'

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

	const onContentReady = useContentReady()

	useEffect(() => {
		if (query.data) onContentReady()
	}, [query.data, onContentReady])

	if (!query.data) return null

	const k = query.data.kpis
	const charts = query.data.charts

	return (
		<div className="flex flex-col gap-6">
			{query.data.narrative && <NarrativeCallout>{query.data.narrative}</NarrativeCallout>}

			<SectionHeader>FXRP</SectionHeader>
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				<KpiCard label="Total FXRP Supply" value={k.totalFxrpSupply} />
				<KpiCard label="% Locked in DeFi" value={k.pctLockedInDefi} />
				<KpiCard label="Value Locked in DeFi" value={k.valueLockedInDefiUsd} />
				<KpiCard label="FXRP Locked in DeFi" value={k.fxrpLockedInDefi} />
			</div>

			{charts.locked && (
				<ChartCard title={charts.locked.title} subtitle="USD value of FXRP locked in Flare DeFi over time.">
					<MultiSeriesChart
						dataset={charts.locked.dataset}
						charts={charts.locked.charts}
						valueSymbol="$"
						title=""
						height="360px"
						chartOptions={charts.locked.chartOptions}
					/>
				</ChartCard>
			)}

			{charts.dist && (
				<ChartCard title={charts.dist.title} subtitle="Share of FXRP locked, by DeFi protocol.">
					<div className="mx-auto w-full max-w-3xl">
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
					</div>
				</ChartCard>
			)}

			<SectionHeader>Activity</SectionHeader>
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
				<KpiCard label="Total DeFi Txns" value={k.totalDefiTransactions} />
				<KpiCard label="Total Minters" value={k.totalMinters} />
				<KpiCard label="Mints" value={k.mintCount} />
				<KpiCard label="Burns" value={k.burnCount} />
				<KpiCard label="Swaps" value={k.swapCount} />
			</div>
		</div>
	)
}
