import { useQuery } from '@tanstack/react-query'
import { lazy, useEffect } from 'react'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { useContentReady } from '~/containers/Investors/ContentReadyContext'
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

	const onContentReady = useContentReady()

	useEffect(() => {
		if (query.data) onContentReady()
	}, [query.data, onContentReady])

	if (!query.data) return null

	const { tvl, stables, fxrp } = query.data

	return (
		<div className="flex flex-col gap-6">
			<SectionHeader>Chain Ecosystem</SectionHeader>
			<ChartCard
				title={tvl.title}
				subtitle="Total value locked across Flare DeFi protocols."
				value={tvl.currentFormatted}
			>
				<MultiSeriesChart
					dataset={tvl.dataset}
					charts={tvl.charts}
					valueSymbol="$"
					title=""
					height="360px"
					chartOptions={tvl.chartOptions}
				/>
			</ChartCard>

			{fxrp && (
				<>
					<SectionHeader>FXRP</SectionHeader>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
						<KpiCard label="Total FXRP Supply" value={fxrp.totalFxrpSupply} />
						<KpiCard label="% Locked in DeFi" value={fxrp.pctLockedInDefi} />
						<KpiCard label="Value Locked in DeFi" value={fxrp.valueLockedInDefiUsd} />
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
