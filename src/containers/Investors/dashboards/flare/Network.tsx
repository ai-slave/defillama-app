import { useQuery } from '@tanstack/react-query'
import { lazy } from 'react'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { PanelStatus, PanelLoadingStatus } from '~/ui/Status'
import { StatTile } from '~/ui/SummaryStats'
import { queryReadFailed } from '~/utils/query'
import { readInvestorApiJson } from '../../api.types'
import { CSV_ONLY_EXPORT } from './chartDefaults'
import { buildFlareNetworkData, type NetworkAPIResponse } from './data'
import { ChartCard, SectionHeader } from './ui'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

export default function Network() {
	const query = useQuery({
		queryKey: ['flare-network'],
		queryFn: async () => {
			const res = await fetch('/api/public/flare/network')
			if (!res.ok) throw new Error(`Flare network API error: ${res.status}`)
			return buildFlareNetworkData(await readInvestorApiJson<NetworkAPIResponse>(res))
		},
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false
	})

	// A failed refresh of data already shown keeps it; the error and its Try again replace the tab only before data loads.
	if (queryReadFailed(query) && !query.data)
		return (
			<PanelStatus variant="error" retry={query}>
				Couldn't load Flare network data.
			</PanelStatus>
		)
	if (!query.data) return <PanelLoadingStatus />

	const k = query.data.kpis
	const c = query.data.charts

	return (
		<div className="flex flex-col gap-6">
			<SectionHeader>Network Stats</SectionHeader>
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
				<StatTile label="Total Txns" value={k.totalTransactions} />
				<StatTile label="24h Txns" value={k.transactions24h} />
				<StatTile label="Avg Daily 7d" value={k.avgDailyTxs7d} />
				<StatTile label="Avg Daily 30d" value={k.avgDailyTxs30d} />
				<StatTile label="Total Addresses" value={k.totalAddresses} />
			</div>

			{c.transactions.dataset.source.length > 0 && (
				<ChartCard
					title={c.transactions.title ?? 'Daily Transactions'}
					subtitle="Transactions settled on Flare each day."
				>
					<MultiSeriesChart
						dataset={c.transactions.dataset}
						charts={c.transactions.charts}
						valueSymbol=""
						title=""
						height="320px"
						exportButtons={CSV_ONLY_EXPORT}
						chartOptions={c.transactions.chartOptions}
					/>
				</ChartCard>
			)}

			{c.activeAccounts.dataset.source.length > 0 && (
				<ChartCard
					title={c.activeAccounts.title ?? 'Daily Active Accounts'}
					subtitle="Unique accounts active on Flare each day."
				>
					<MultiSeriesChart
						dataset={c.activeAccounts.dataset}
						charts={c.activeAccounts.charts}
						valueSymbol=""
						title=""
						height="320px"
						exportButtons={CSV_ONLY_EXPORT}
						chartOptions={c.activeAccounts.chartOptions}
					/>
				</ChartCard>
			)}
		</div>
	)
}
