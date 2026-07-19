import { getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'
import type { ColumnDef, PaginationState, SortingState } from '@tanstack/react-table'
import { lazy, useMemo, useState } from 'react'
import type { IMultiSeriesChart2Props, MultiSeriesChart2Dataset } from '~/components/ECharts/types'
import { VirtualTable } from '~/components/Table/Table'
import { formattedNum } from '~/utils'
import { useMapleActivePools, parseWad, parseFeeRate } from './api'
import {
	ChartCard,
	CardSkeleton,
	KpiCard,
	KpiSkeleton,
	MAPLE_CSV_ONLY_EXPORT,
	MAPLE_PERCENT_CATEGORY_CHART_OPTIONS,
	MAPLE_USD_CATEGORY_CHART_OPTIONS,
	Pagination,
	formatPct
} from './shared'

const MultiSeriesChart2 = lazy(
	() => import('~/components/ECharts/MultiSeriesChart2')
) as React.FC<IMultiSeriesChart2Props>

const TVL_CHART: IMultiSeriesChart2Props['charts'] = [
	{
		type: 'bar',
		name: 'TVL',
		encode: { x: 'Name', y: 'TVL' },
		color: '#4FC3F7',
		stack: 'a'
	}
]
const UTILIZATION_CHART: IMultiSeriesChart2Props['charts'] = [
	{
		type: 'bar',
		name: 'Utilization',
		encode: { x: 'Name', y: 'Utilization' },
		color: '#AB47BC',
		stack: 'a'
	}
]
const APY_CHART: IMultiSeriesChart2Props['charts'] = [
	{
		type: 'bar',
		name: 'Spot APY',
		encode: { x: 'Name', y: 'Spot APY' },
		color: '#66BB6A',
		stack: 'a'
	}
]

interface PoolRow {
	name: string
	asset: string
	tvlUsd: number
	spotApy: number
	numOpenTermLoans: number
	utilization: number
	numPositions: number
	feeRate: number
	openToPublic: boolean
	unrealizedLosses: number
}

const poolColumns: ColumnDef<PoolRow>[] = [
	{ header: 'Pool', accessorKey: 'name', size: 220 },
	{ header: 'Asset', accessorKey: 'asset', size: 80 },
	{
		header: 'TVL',
		accessorKey: 'tvlUsd',
		cell: ({ getValue }) => formattedNum(getValue<number>(), true),
		meta: { align: 'end' as const },
		size: 140
	},
	{
		header: 'Spot APY',
		accessorKey: 'spotApy',
		cell: ({ getValue }) => formatPct(getValue<number>()),
		meta: { align: 'end' as const },
		size: 100
	},
	{
		header: 'Utilization',
		accessorKey: 'utilization',
		cell: ({ getValue }) => formatPct(getValue<number>()),
		meta: { align: 'end' as const },
		size: 100
	},
	{
		header: 'Depositors',
		accessorKey: 'numPositions',
		cell: ({ getValue }) => formattedNum(getValue<number>(), false),
		meta: { align: 'end' as const },
		size: 100
	},
	{ header: 'Open Loans', accessorKey: 'numOpenTermLoans', meta: { align: 'end' as const }, size: 100 },
	{
		header: 'Fees',
		accessorKey: 'feeRate',
		cell: ({ getValue }) => formatPct(getValue<number>()),
		meta: { align: 'end' as const },
		size: 80
	},
	{
		header: 'Access',
		accessorKey: 'openToPublic',
		cell: ({ getValue }) => (getValue<boolean>() ? 'Public' : 'Permissioned'),
		size: 110
	}
]

function PoolsTable({ data }: { data: PoolRow[] }) {
	const [sorting, setSorting] = useState<SortingState>([{ id: 'tvlUsd', desc: true }])
	const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 15 })

	const instance = useReactTable({
		data,
		columns: poolColumns,
		state: { sorting, pagination },
		onSortingChange: setSorting,
		onPaginationChange: setPagination,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel()
	})

	if (data.length === 0) return null

	return (
		<div className="rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4">
			<h3 className="mb-3 text-sm font-medium text-pro-text-label">Active Pools</h3>
			<VirtualTable instance={instance} skipVirtualization />
			{data.length > 15 && <Pagination table={instance} />}
		</div>
	)
}

export default function PoolsOverview() {
	const { pools, isLoading } = useMapleActivePools()

	const poolRows = useMemo<PoolRow[]>(() => {
		return pools
			.map((p) => {
				const totalAssets = parseFloat(p.totalAssets)
				const principalOut = parseFloat(p.principalOut)
				const utilization = totalAssets > 0 ? (principalOut / totalAssets) * 100 : 0
				const delegateFee = parseFeeRate(p.delegateManagementFeeRate)
				const platformFee = parseFeeRate(p.platformManagementFeeRate)
				return {
					name: p.name,
					asset: p.asset.symbol,
					tvlUsd: parseFloat(p.tvlUsd),
					spotApy: parseWad(p.spotApy, 28),
					numOpenTermLoans: parseInt(p.numOpenTermLoans),
					utilization,
					numPositions: parseInt(p.numPositions),
					feeRate: delegateFee + platformFee,
					openToPublic: p.openToPublic,
					unrealizedLosses: parseFloat(p.unrealizedLosses)
				}
			})
			.sort((a, b) => b.tvlUsd - a.tvlUsd)
	}, [pools])

	const view = useMemo(() => {
		let totalTvl = 0
		let totalDepositors = 0
		let weightedApySum = 0
		let weightedUtilSum = 0
		const tvlSource: Array<{ Name: string; TVL: number }> = []
		const utilizationSource: Array<{ Name: string; Utilization: number }> = []
		const apySource: Array<{ Name: string; 'Spot APY': number }> = []

		for (const pool of poolRows) {
			totalTvl += pool.tvlUsd
			totalDepositors += pool.numPositions
			weightedApySum += pool.spotApy * pool.tvlUsd
			weightedUtilSum += pool.utilization * pool.tvlUsd
			if (pool.tvlUsd >= 10000) {
				tvlSource.push({ Name: pool.name, TVL: pool.tvlUsd })
				if (pool.utilization > 0) utilizationSource.push({ Name: pool.name, Utilization: pool.utilization })
			}
			if (pool.spotApy > 0) apySource.push({ Name: pool.name, 'Spot APY': pool.spotApy })
		}

		utilizationSource.sort((a, b) => b.Utilization - a.Utilization)
		apySource.sort((a, b) => b['Spot APY'] - a['Spot APY'])
		return {
			kpis:
				isLoading || pools.length === 0
					? null
					: {
							totalTvl: formattedNum(totalTvl, true),
							activePools: pools.length,
							totalDepositors: formattedNum(totalDepositors, false),
							avgApy: `${(totalTvl > 0 ? weightedApySum / totalTvl : 0).toFixed(2)}%`,
							avgUtil: `${(totalTvl > 0 ? weightedUtilSum / totalTvl : 0).toFixed(1)}%`
						},
			tvl: { dimensions: ['Name', 'TVL'], source: tvlSource } satisfies MultiSeriesChart2Dataset,
			utilization: {
				dimensions: ['Name', 'Utilization'],
				source: utilizationSource
			} satisfies MultiSeriesChart2Dataset,
			apy: { dimensions: ['Name', 'Spot APY'], source: apySource } satisfies MultiSeriesChart2Dataset
		}
	}, [isLoading, poolRows, pools.length])

	return (
		<div className="flex flex-col gap-4">
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
				{view.kpis ? (
					<>
						<KpiCard label="Total TVL" value={view.kpis.totalTvl} />
						<KpiCard label="Active Pools" value={view.kpis.activePools} />
						<KpiCard label="Total Depositors" value={view.kpis.totalDepositors} />
						<KpiCard label="Avg Pool APY" value={view.kpis.avgApy} />
						<KpiCard label="Avg Utilization" value={view.kpis.avgUtil} />
					</>
				) : (
					<>
						<KpiSkeleton label="Total TVL" />
						<KpiSkeleton label="Active Pools" />
						<KpiSkeleton label="Total Depositors" />
						<KpiSkeleton label="Avg Pool APY" />
						<KpiSkeleton label="Avg Utilization" />
					</>
				)}
			</div>

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				{isLoading ? (
					<CardSkeleton title="TVL by Pool" />
				) : (
					<ChartCard title="TVL by Pool">
						<MultiSeriesChart2
							dataset={view.tvl}
							charts={TVL_CHART}
							valueSymbol="$"
							height="400px"
							chartOptions={MAPLE_USD_CATEGORY_CHART_OPTIONS}
							exportButtons={MAPLE_CSV_ONLY_EXPORT}
						/>
					</ChartCard>
				)}

				{isLoading ? (
					<CardSkeleton title="Pool Utilization" />
				) : view.utilization.source.length > 0 ? (
					<ChartCard title="Pool Utilization">
						<MultiSeriesChart2
							dataset={view.utilization}
							charts={UTILIZATION_CHART}
							valueSymbol="%"
							height="400px"
							chartOptions={MAPLE_PERCENT_CATEGORY_CHART_OPTIONS}
							exportButtons={MAPLE_CSV_ONLY_EXPORT}
						/>
					</ChartCard>
				) : null}
			</div>

			{isLoading ? (
				<CardSkeleton title="Spot APY by Pool" />
			) : view.apy.source.length > 0 ? (
				<ChartCard title="Spot APY by Pool">
					<MultiSeriesChart2
						dataset={view.apy}
						charts={APY_CHART}
						valueSymbol="%"
						height="400px"
						chartOptions={MAPLE_PERCENT_CATEGORY_CHART_OPTIONS}
						exportButtons={MAPLE_CSV_ONLY_EXPORT}
					/>
				</ChartCard>
			) : null}

			{isLoading ? <CardSkeleton title="Active Pools" /> : <PoolsTable data={poolRows} />}
		</div>
	)
}
