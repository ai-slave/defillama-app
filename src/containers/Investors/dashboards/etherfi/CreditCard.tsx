import { lazy, useMemo } from 'react'
import { createTimeSeriesChartOptions } from '~/components/ECharts/timeSeriesChartOptions'
import type { IMultiSeriesChart2Props } from '~/components/ECharts/types'
import { formattedNum } from '~/utils'
import { useEtherfiCashFeesCharts, useEtherfiCashMetrics, useEtherfiCashTvlChart } from './api'

const MultiSeriesChart2 = lazy(
	() => import('~/components/ECharts/MultiSeriesChart2')
) as React.FC<IMultiSeriesChart2Props>

const AREA_EXPORT = { csv: true, png: true, filename: 'chart' } as const
const BAR_EXPORT = { csv: true, png: false, filename: 'bar-chart-data' } as const
const DOLLAR_TIME_CHART_OPTIONS = createTimeSeriesChartOptions('$')

const TVL_CHART: IMultiSeriesChart2Props['charts'] = [
	{ name: 'TVL', type: 'line', encode: { x: 'timestamp', y: 'TVL' } }
]
const FEES_CHART: IMultiSeriesChart2Props['charts'] = [
	{ name: 'Fees', type: 'bar', encode: { x: 'timestamp', y: 'Fees' }, color: '#4FC3F7', stack: 'a' }
]
const REVENUE_CHART: IMultiSeriesChart2Props['charts'] = [
	{ name: 'Revenue', type: 'bar', encode: { x: 'timestamp', y: 'Revenue' }, color: '#66BB6A', stack: 'a' }
]
const HOLDERS_REVENUE_CHART: IMultiSeriesChart2Props['charts'] = [
	{
		name: 'Holders Revenue',
		type: 'bar',
		encode: { x: 'timestamp', y: 'Holders Revenue' },
		color: '#FFA726',
		stack: 'a'
	}
]
const INFLOWS_CHART: IMultiSeriesChart2Props['charts'] = [
	{
		name: 'USD Inflows',
		type: 'bar',
		encode: { x: 'timestamp', y: 'USD Inflows' },
		color: '#AB47BC',
		stack: 'a'
	}
]

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div className="rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4">
			<h3 className="mb-3 text-sm font-medium text-pro-text-label">{title}</h3>
			{children}
		</div>
	)
}

function CardSkeleton({ title }: { title: string }) {
	return (
		<div className="rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4">
			<h3 className="mb-3 text-sm font-medium text-pro-text-label">{title}</h3>
			<div className="flex h-[400px] items-center justify-center">
				<div className="size-5 animate-spin rounded-full border-2 border-tertiary border-t-transparent" />
			</div>
		</div>
	)
}

function KpiCard({ label, value }: { label: string; value: string | number | null }) {
	return (
		<div className="flex flex-col gap-1 rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4">
			<span className="text-xs font-medium tracking-wide text-pro-text-label">{label}</span>
			<span className="text-2xl font-semibold text-pro-text-primary">{value ?? '—'}</span>
		</div>
	)
}

function KpiSkeleton({ label }: { label: string }) {
	return (
		<div className="flex flex-col gap-1 rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4">
			<span className="text-xs font-medium tracking-wide text-pro-text-label">{label}</span>
			<div className="h-8 w-24 animate-pulse rounded-sm bg-tertiary opacity-20" />
		</div>
	)
}

export default function CreditCard() {
	const { fees, revenue, isLoading: metricsLoading } = useEtherfiCashMetrics()
	const { tvlDataset, inflowsDataset, previousTvl, previousInflow, isLoading: tvlLoading } = useEtherfiCashTvlChart()
	const {
		feesDataset,
		revenueDataset,
		holdersRevenueDataset,
		hasHoldersRevenue,
		isLoading: feesLoading
	} = useEtherfiCashFeesCharts()

	const kpis = useMemo(() => {
		if (metricsLoading || tvlLoading) return null

		return {
			tvl: previousTvl != null ? formattedNum(previousTvl, true) : '—',
			fees24h: fees?.total48hto24h != null ? formattedNum(fees.total48hto24h, true) : '—',
			revenue24h: revenue?.total48hto24h != null ? formattedNum(revenue.total48hto24h, true) : '—',
			inflows: previousInflow != null ? formattedNum(previousInflow, true) : '—'
		}
	}, [fees, revenue, previousTvl, previousInflow, metricsLoading, tvlLoading])

	return (
		<div className="flex flex-col gap-4">
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				{kpis ? (
					<>
						<KpiCard label="TVL" value={kpis.tvl} />
						<KpiCard label="Fees (24h)" value={kpis.fees24h} />
						<KpiCard label="Revenue (24h)" value={kpis.revenue24h} />
						<KpiCard label="USD Inflows (Latest)" value={kpis.inflows} />
					</>
				) : (
					<>
						<KpiSkeleton label="TVL" />
						<KpiSkeleton label="Fees (24h)" />
						<KpiSkeleton label="Revenue (24h)" />
						<KpiSkeleton label="USD Inflows (Latest)" />
					</>
				)}
			</div>

			{tvlLoading ? (
				<CardSkeleton title="TVL" />
			) : (
				<ChartCard title="TVL">
					<MultiSeriesChart2
						dataset={tvlDataset}
						charts={TVL_CHART}
						valueSymbol="$"
						title=""
						height="400px"
						chartOptions={DOLLAR_TIME_CHART_OPTIONS}
						exportButtons={AREA_EXPORT}
					/>
				</ChartCard>
			)}

			{feesLoading ? (
				<CardSkeleton title="Fees" />
			) : (
				<ChartCard title="Fees">
					<MultiSeriesChart2
						dataset={feesDataset}
						charts={FEES_CHART}
						valueSymbol="$"
						title=""
						height="400px"
						chartOptions={DOLLAR_TIME_CHART_OPTIONS}
						exportButtons={BAR_EXPORT}
					/>
				</ChartCard>
			)}

			{feesLoading ? (
				<CardSkeleton title="Revenue" />
			) : (
				<ChartCard title="Revenue">
					<MultiSeriesChart2
						dataset={revenueDataset}
						charts={REVENUE_CHART}
						valueSymbol="$"
						title=""
						height="400px"
						chartOptions={DOLLAR_TIME_CHART_OPTIONS}
						exportButtons={BAR_EXPORT}
					/>
				</ChartCard>
			)}

			{!feesLoading && hasHoldersRevenue && (
				<ChartCard title="Holders Revenue">
					<MultiSeriesChart2
						dataset={holdersRevenueDataset}
						charts={HOLDERS_REVENUE_CHART}
						valueSymbol="$"
						title=""
						height="400px"
						chartOptions={DOLLAR_TIME_CHART_OPTIONS}
						exportButtons={BAR_EXPORT}
					/>
				</ChartCard>
			)}

			{tvlLoading ? (
				<CardSkeleton title="USD Inflows" />
			) : (
				<ChartCard title="USD Inflows">
					<MultiSeriesChart2
						dataset={inflowsDataset}
						charts={INFLOWS_CHART}
						valueSymbol="$"
						title=""
						height="400px"
						chartOptions={DOLLAR_TIME_CHART_OPTIONS}
						exportButtons={BAR_EXPORT}
					/>
				</ChartCard>
			)}
		</div>
	)
}
