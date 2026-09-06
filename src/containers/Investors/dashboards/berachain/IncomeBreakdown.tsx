import { lazy, useMemo } from 'react'
import type {
	IMultiSeriesChartProps,
	MultiSeriesChartDataset,
	MultiSeriesChartSeriesConfig
} from '~/components/ECharts/MultiSeriesChart/types'
import { useCustomServerData } from '~/containers/Investors/CustomServerDataContext'
import { Tooltip } from '~/ui/Tooltip'
import { formatUsd } from '~/utils/numberFormat'
import { type BerachainIncomeServerData, useBerachainIncomeData, useHoneyRevenueData } from './api'
import { AREA_CHART_EXPORTS, BAR_CHART_EXPORTS, createChartOptions } from './chartDefaults'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

const TOTAL_REVENUE_CHARTS = [
	{
		type: 'line',
		name: 'Chain Fees',
		encode: { x: 0, y: 1 },
		color: '#4FC3F7',
		stack: 'Total'
	},
	{
		type: 'line',
		name: 'BEX Revenue',
		encode: { x: 0, y: 2 },
		color: '#66BB6A',
		stack: 'Total'
	},
	{
		type: 'line',
		name: 'BEND Revenue',
		encode: { x: 0, y: 3 },
		color: '#EF5350',
		stack: 'Total'
	}
] satisfies Array<MultiSeriesChartSeriesConfig>

const BERACHAIN_MONTHLY_CHARTS = [
	{
		type: 'bar',
		name: 'Chain Fees',
		encode: { x: 0, y: 1 },
		color: '#4FC3F7',
		stack: 'a'
	}
] satisfies Array<MultiSeriesChartSeriesConfig>

const CHAIN_FEES_CHART = [
	{
		type: 'line',
		name: 'Chain Fees',
		encode: { x: 0, y: 1 },
		color: '#4FC3F7'
	}
] satisfies Array<MultiSeriesChartSeriesConfig>

const BEX_MONTHLY_CHART = [
	{
		type: 'bar',
		name: 'Revenue',
		encode: { x: 0, y: 1 },
		color: '#66BB6A',
		stack: 'a'
	}
] satisfies Array<MultiSeriesChartSeriesConfig>

const BEX_CUMULATIVE_CHART = [
	{
		type: 'line',
		name: 'Revenue',
		encode: { x: 0, y: 1 },
		color: '#66BB6A'
	}
] satisfies Array<MultiSeriesChartSeriesConfig>

const BEND_MONTHLY_CHARTS = [
	{
		type: 'bar',
		name: 'Fees',
		encode: { x: 0, y: 1 },
		color: '#AB47BC',
		stack: 'a'
	},
	{
		type: 'bar',
		name: 'Revenue',
		encode: { x: 0, y: 2 },
		color: '#EF5350',
		stack: 'a'
	}
] satisfies Array<MultiSeriesChartSeriesConfig>

const BEND_FEES_CHART = [
	{
		type: 'line',
		name: 'Fees',
		encode: { x: 0, y: 1 },
		color: '#AB47BC'
	}
] satisfies Array<MultiSeriesChartSeriesConfig>

const BEND_REVENUE_CHART = [
	{
		type: 'line',
		name: 'Revenue',
		encode: { x: 0, y: 1 },
		color: '#EF5350'
	}
] satisfies Array<MultiSeriesChartSeriesConfig>

const DOLLAR_CHART_OPTIONS = createChartOptions('$')
const STACKED_DOLLAR_CHART_OPTIONS = createChartOptions('$', true)

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

function InfoIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="inline-block text-pro-text-label opacity-50">
			<circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
			<path d="M8 7v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
			<circle cx="8" cy="5" r="0.75" fill="currentColor" />
		</svg>
	)
}

function KpiCard({ label, value, tooltip }: { label: string; value: string | number | null; tooltip?: string }) {
	return (
		<div className="flex flex-col gap-1 rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4">
			<span className="flex items-center gap-1 text-xs font-medium tracking-wide text-pro-text-label">
				{label}
				{tooltip && (
					<Tooltip content={tooltip}>
						<span className="cursor-help">
							<InfoIcon />
						</span>
					</Tooltip>
				)}
			</span>
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

function SectionHeader({ title }: { title: string }) {
	return <h2 className="heading-xs tracking-tight text-pro-text-primary">{title}</h2>
}

function getCumulativeTotal(dataset: MultiSeriesChartDataset, key: string) {
	const dimensionIndex = dataset.dimensions.indexOf(key)
	if (dimensionIndex < 0 || dataset.source.length === 0) return null
	return formatUsd(dataset.source[dataset.source.length - 1][dimensionIndex], {
		compact: true,
		minimumCompactValue: 1_000_000,
		compactSuffix: 'lowercase'
	})
}

export default function IncomeBreakdown() {
	const serverData = useCustomServerData<BerachainIncomeServerData>('berachainIncome')
	const { isLoading, berachain, bex, bend, totalRevenue } = useBerachainIncomeData(serverData)
	const { data: honeyRevenue, isLoading: isHoneyLoading } = useHoneyRevenueData()

	const kpis = useMemo(() => {
		if (isLoading) return null
		return {
			chainFees: getCumulativeTotal(berachain.cumulative, 'Chain Fees'),
			bexRevenue: getCumulativeTotal(bex.cumulative, 'Revenue'),
			bexVolume: getCumulativeTotal(bex.volumeCumulative, 'Volume'),
			bendFees: getCumulativeTotal(bend.cumulative, 'Fees'),
			bendRevenue: getCumulativeTotal(bend.cumulative, 'Revenue')
		}
	}, [isLoading, berachain, bex, bend])

	return (
		<div className="flex flex-col gap-6">
			{/* HONEY Revenue Section */}
			<SectionHeader title="HONEY Backing Yield Revenue" />
			<div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
				{isHoneyLoading || !honeyRevenue ? (
					<>
						<KpiSkeleton label="HONEY Supply" />
						<KpiSkeleton label="sUSDe Yield (Current)" />
						<KpiSkeleton label="sUSDe Yield (30d Avg)" />
						<KpiSkeleton label="Annual Revenue (Current)" />
						<KpiSkeleton label="Annual Revenue (30d Avg)" />
						<KpiSkeleton label="Annual Revenue (Inception Avg)" />
					</>
				) : (
					<>
						<KpiCard
							label="HONEY Supply"
							value={honeyRevenue.honeySupply.formatted}
							tooltip="Current HONEY total supply. Since HONEY ≈ $1, this approximates its market cap."
						/>
						<KpiCard
							label="sUSDe Yield (Current)"
							value={honeyRevenue.susdeYield.current.formatted}
							tooltip="Latest sUSDe staking yield from Ethena (7-day rolling average)."
						/>
						<KpiCard
							label="sUSDe Yield (30d Avg)"
							value={honeyRevenue.susdeYield.avg30d.formatted}
							tooltip="30-day average sUSDe staking yield from Ethena."
						/>
						<KpiCard
							label="Annual Revenue (Current Yield)"
							value={honeyRevenue.kpis.annualRevenueCurrent.formatted}
							tooltip="Projected annual revenue using HONEY supply × current sUSDe yield."
						/>
						<KpiCard
							label="Annual Revenue (30d Avg Yield)"
							value={honeyRevenue.kpis.annualRevenue30d.formatted}
							tooltip="Projected annual revenue using HONEY supply × 30-day average sUSDe yield."
						/>
						<KpiCard
							label="Annual Revenue (Inception Avg)"
							value={honeyRevenue.kpis.annualRevenueInception.formatted}
							tooltip="Historical benchmark using HONEY supply × average sUSDe yield since USDe launch (Nov 2023)."
						/>
					</>
				)}
			</div>

			<SectionHeader title="Chain Fees" />
			<div className="grid grid-cols-1 gap-4">
				{kpis ? <KpiCard label="Total Chain Fees" value={kpis.chainFees} /> : <KpiSkeleton label="Total Chain Fees" />}
			</div>

			{isLoading ? (
				<CardSkeleton title="Cumulative Revenue (all sources)" />
			) : (
				<ChartCard title="Cumulative Revenue (all sources)">
					<MultiSeriesChart
						dataset={totalRevenue.cumulative}
						charts={TOTAL_REVENUE_CHARTS}
						chartOptions={STACKED_DOLLAR_CHART_OPTIONS}
						exportButtons={AREA_CHART_EXPORTS}
						valueSymbol="$"
						title=""
						height="400px"
						solidChartAreaStyle
					/>
				</ChartCard>
			)}

			{isLoading ? (
				<CardSkeleton title="Monthly Breakdown" />
			) : (
				<ChartCard title="Monthly Breakdown">
					<MultiSeriesChart
						dataset={berachain.monthly}
						charts={BERACHAIN_MONTHLY_CHARTS}
						chartOptions={DOLLAR_CHART_OPTIONS}
						exportButtons={BAR_CHART_EXPORTS}
						hideDefaultLegend={false}
						valueSymbol="$"
						title=""
						height="400px"
					/>
				</ChartCard>
			)}

			{isLoading ? (
				<CardSkeleton title="Cumulative Chain Fees" />
			) : (
				<ChartCard title="Cumulative Chain Fees">
					<MultiSeriesChart
						dataset={berachain.chainFeesCumulative}
						charts={CHAIN_FEES_CHART}
						chartOptions={DOLLAR_CHART_OPTIONS}
						exportButtons={AREA_CHART_EXPORTS}
						valueSymbol="$"
						title=""
						height="400px"
					/>
				</ChartCard>
			)}

			{/* BEX Section */}
			<SectionHeader title="BEX" />
			<div className="grid grid-cols-2 gap-4">
				{kpis ? (
					<>
						<KpiCard label="Total BEX Revenue" value={kpis.bexRevenue} />
						<KpiCard label="Cumulative Volume" value={kpis.bexVolume} />
					</>
				) : (
					<>
						<KpiSkeleton label="Total BEX Revenue" />
						<KpiSkeleton label="Cumulative Volume" />
					</>
				)}
			</div>

			{isLoading ? (
				<CardSkeleton title="Monthly Revenue" />
			) : (
				<ChartCard title="Monthly Revenue">
					<MultiSeriesChart
						dataset={bex.monthly}
						charts={BEX_MONTHLY_CHART}
						chartOptions={DOLLAR_CHART_OPTIONS}
						exportButtons={BAR_CHART_EXPORTS}
						valueSymbol="$"
						title=""
						height="400px"
					/>
				</ChartCard>
			)}

			{isLoading ? (
				<CardSkeleton title="Cumulative Revenue" />
			) : (
				<ChartCard title="Cumulative Revenue">
					<MultiSeriesChart
						dataset={bex.cumulative}
						charts={BEX_CUMULATIVE_CHART}
						chartOptions={DOLLAR_CHART_OPTIONS}
						exportButtons={AREA_CHART_EXPORTS}
						valueSymbol="$"
						title=""
						height="400px"
					/>
				</ChartCard>
			)}

			{/* Bend Section */}
			<SectionHeader title="Bend" />
			<div className="grid grid-cols-2 gap-4">
				{kpis ? (
					<>
						<KpiCard label="Total Bend Fees" value={kpis.bendFees} />
						<KpiCard label="Total Bend Revenue" value={kpis.bendRevenue} />
					</>
				) : (
					<>
						<KpiSkeleton label="Total Bend Fees" />
						<KpiSkeleton label="Total Bend Revenue" />
					</>
				)}
			</div>

			{isLoading ? (
				<CardSkeleton title="Monthly Breakdown" />
			) : (
				<ChartCard title="Monthly Breakdown">
					<MultiSeriesChart
						dataset={bend.monthly}
						charts={BEND_MONTHLY_CHARTS}
						chartOptions={DOLLAR_CHART_OPTIONS}
						exportButtons={BAR_CHART_EXPORTS}
						hideDefaultLegend={false}
						valueSymbol="$"
						title=""
						height="400px"
					/>
				</ChartCard>
			)}

			{isLoading ? (
				<CardSkeleton title="Cumulative Fees" />
			) : (
				<ChartCard title="Cumulative Fees">
					<MultiSeriesChart
						dataset={bend.feesCumulative}
						charts={BEND_FEES_CHART}
						chartOptions={DOLLAR_CHART_OPTIONS}
						exportButtons={AREA_CHART_EXPORTS}
						valueSymbol="$"
						title=""
						height="400px"
					/>
				</ChartCard>
			)}

			{isLoading ? (
				<CardSkeleton title="Cumulative Revenue" />
			) : (
				<ChartCard title="Cumulative Revenue">
					<MultiSeriesChart
						dataset={bend.revenueCumulative}
						charts={BEND_REVENUE_CHART}
						chartOptions={DOLLAR_CHART_OPTIONS}
						exportButtons={AREA_CHART_EXPORTS}
						valueSymbol="$"
						title=""
						height="400px"
					/>
				</ChartCard>
			)}
		</div>
	)
}
