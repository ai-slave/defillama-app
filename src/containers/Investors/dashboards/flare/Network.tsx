import { useQuery } from '@tanstack/react-query'
import { lazy } from 'react'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { TabStatus } from '~/containers/Investors/TabStatus'
import { readInvestorApiJson } from '../../api.types'
import { CSV_ONLY_EXPORT } from './chartDefaults'
import { buildFlareNetworkData, type NetworkAPIResponse } from './data'
import { ChartCard, KpiCard, SectionHeader } from './ui'

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

	if (query.error) return <TabStatus variant="error">Couldn't load Flare network data.</TabStatus>
	if (!query.data) return <TabStatus variant="loading" />

	const k = query.data.kpis
	const c = query.data.charts

	return (
		<div className="flex flex-col gap-6">
			<SectionHeader>Network Stats</SectionHeader>
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
				<KpiCard label="Total Txns" value={k.totalTransactions} />
				<KpiCard label="24h Txns" value={k.transactions24h} />
				<KpiCard label="Avg Daily 7d" value={k.avgDailyTxs7d} />
				<KpiCard label="Avg Daily 30d" value={k.avgDailyTxs30d} />
				<KpiCard label="Total Addresses" value={k.totalAddresses} />
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
