import { lazy, Suspense, useMemo } from 'react'
import type {
	IMultiSeriesChartProps,
	MultiSeriesChartDataset,
	MultiSeriesChartSeriesConfig
} from '~/components/ECharts/MultiSeriesChart/types'
import { useCustomServerData } from '~/containers/Investors/CustomServerDataContext'
import { CHART_FILL, ChartPanelExportShellLoading } from '~/ui/ChartPanel'
import { Panel } from '~/ui/Panel'
import { PanelLoadingStatus } from '~/ui/Status'
import { StatTile } from '~/ui/SummaryStats'
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
			<h2 className="heading-xs">HONEY backing yield revenue</h2>
			<div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
				{isHoneyLoading || !honeyRevenue ? (
					<>
						<StatTile label="HONEY Supply" loading />
						<StatTile label="sUSDe Yield (Current)" loading />
						<StatTile label="sUSDe Yield (30d Avg)" loading />
						<StatTile label="Annual Revenue (Current Yield)" loading />
						<StatTile label="Annual Revenue (30d Avg Yield)" loading />
						<StatTile label="Annual Revenue (Inception Avg)" loading />
					</>
				) : (
					<>
						<StatTile
							label="HONEY Supply"
							value={honeyRevenue.honeySupply.formatted}
							tooltip="Current HONEY total supply. Since HONEY ≈ $1, this approximates its market cap."
						/>
						<StatTile
							label="sUSDe Yield (Current)"
							value={honeyRevenue.susdeYield.current.formatted}
							tooltip="Latest sUSDe staking yield from Ethena (7-day rolling average)."
						/>
						<StatTile
							label="sUSDe Yield (30d Avg)"
							value={honeyRevenue.susdeYield.avg30d.formatted}
							tooltip="30-day average sUSDe staking yield from Ethena."
						/>
						<StatTile
							label="Annual Revenue (Current Yield)"
							value={honeyRevenue.kpis.annualRevenueCurrent.formatted}
							tooltip="Projected annual revenue using HONEY supply × current sUSDe yield."
						/>
						<StatTile
							label="Annual Revenue (30d Avg Yield)"
							value={honeyRevenue.kpis.annualRevenue30d.formatted}
							tooltip="Projected annual revenue using HONEY supply × 30-day average sUSDe yield."
						/>
						<StatTile
							label="Annual Revenue (Inception Avg)"
							value={honeyRevenue.kpis.annualRevenueInception.formatted}
							tooltip="Historical benchmark using HONEY supply × average sUSDe yield since USDe launch (Nov 2023)."
						/>
					</>
				)}
			</div>

			<h2 className="heading-xs">Chain Fees</h2>
			<div className="grid grid-cols-1 gap-4">
				{kpis ? (
					<StatTile label="Total Chain Fees" value={kpis.chainFees ?? '—'} />
				) : (
					<StatTile label="Total Chain Fees" loading />
				)}
			</div>

			{isLoading ? (
				<PanelLoadingStatus className="min-h-[400px]" />
			) : (
				<Panel>
					<Suspense fallback={<ChartPanelExportShellLoading />}>
						<MultiSeriesChart
							title="Cumulative revenue (all sources)"
							headingAs="h3"
							containerClassName={CHART_FILL}
							dataset={totalRevenue.cumulative}
							charts={TOTAL_REVENUE_CHARTS}
							chartOptions={STACKED_DOLLAR_CHART_OPTIONS}
							exportButtons={AREA_CHART_EXPORTS}
							valueSymbol="$"
							solidChartAreaStyle
						/>
					</Suspense>
				</Panel>
			)}

			{isLoading ? (
				<PanelLoadingStatus className="min-h-[400px]" />
			) : (
				<Panel>
					<Suspense fallback={<ChartPanelExportShellLoading />}>
						<MultiSeriesChart
							title="Monthly breakdown"
							headingAs="h3"
							containerClassName={CHART_FILL}
							{...berachain.monthly}
							charts={BERACHAIN_MONTHLY_CHARTS}
							chartOptions={DOLLAR_CHART_OPTIONS}
							exportButtons={BAR_CHART_EXPORTS}
							showLegend
							valueSymbol="$"
						/>
					</Suspense>
				</Panel>
			)}

			{isLoading ? (
				<PanelLoadingStatus className="min-h-[400px]" />
			) : (
				<Panel>
					<Suspense fallback={<ChartPanelExportShellLoading />}>
						<MultiSeriesChart
							title="Cumulative chain fees"
							headingAs="h3"
							containerClassName={CHART_FILL}
							dataset={berachain.chainFeesCumulative}
							charts={CHAIN_FEES_CHART}
							chartOptions={DOLLAR_CHART_OPTIONS}
							exportButtons={AREA_CHART_EXPORTS}
							valueSymbol="$"
						/>
					</Suspense>
				</Panel>
			)}

			{/* BEX Section */}
			<h2 className="heading-xs">BEX</h2>
			<div className="grid grid-cols-2 gap-4">
				{kpis ? (
					<>
						<StatTile label="Total BEX Revenue" value={kpis.bexRevenue ?? '—'} />
						<StatTile label="Cumulative Volume" value={kpis.bexVolume ?? '—'} />
					</>
				) : (
					<>
						<StatTile label="Total BEX Revenue" loading />
						<StatTile label="Cumulative Volume" loading />
					</>
				)}
			</div>

			{isLoading ? (
				<PanelLoadingStatus className="min-h-[400px]" />
			) : (
				<Panel>
					<Suspense fallback={<ChartPanelExportShellLoading />}>
						<MultiSeriesChart
							title="Monthly revenue"
							headingAs="h3"
							containerClassName={CHART_FILL}
							{...bex.monthly}
							charts={BEX_MONTHLY_CHART}
							chartOptions={DOLLAR_CHART_OPTIONS}
							exportButtons={BAR_CHART_EXPORTS}
							valueSymbol="$"
						/>
					</Suspense>
				</Panel>
			)}

			{isLoading ? (
				<PanelLoadingStatus className="min-h-[400px]" />
			) : (
				<Panel>
					<Suspense fallback={<ChartPanelExportShellLoading />}>
						<MultiSeriesChart
							title="Cumulative revenue"
							headingAs="h3"
							containerClassName={CHART_FILL}
							dataset={bex.cumulative}
							charts={BEX_CUMULATIVE_CHART}
							chartOptions={DOLLAR_CHART_OPTIONS}
							exportButtons={AREA_CHART_EXPORTS}
							valueSymbol="$"
						/>
					</Suspense>
				</Panel>
			)}

			{/* Bend Section */}
			<h2 className="heading-xs">Bend</h2>
			<div className="grid grid-cols-2 gap-4">
				{kpis ? (
					<>
						<StatTile label="Total Bend Fees" value={kpis.bendFees ?? '—'} />
						<StatTile label="Total Bend Revenue" value={kpis.bendRevenue ?? '—'} />
					</>
				) : (
					<>
						<StatTile label="Total Bend Fees" loading />
						<StatTile label="Total Bend Revenue" loading />
					</>
				)}
			</div>

			{isLoading ? (
				<PanelLoadingStatus className="min-h-[400px]" />
			) : (
				<Panel>
					<Suspense fallback={<ChartPanelExportShellLoading />}>
						<MultiSeriesChart
							title="Monthly breakdown"
							headingAs="h3"
							containerClassName={CHART_FILL}
							{...bend.monthly}
							charts={BEND_MONTHLY_CHARTS}
							chartOptions={DOLLAR_CHART_OPTIONS}
							exportButtons={BAR_CHART_EXPORTS}
							showLegend
							valueSymbol="$"
						/>
					</Suspense>
				</Panel>
			)}

			{isLoading ? (
				<PanelLoadingStatus className="min-h-[400px]" />
			) : (
				<Panel>
					<Suspense fallback={<ChartPanelExportShellLoading />}>
						<MultiSeriesChart
							title="Cumulative fees"
							headingAs="h3"
							containerClassName={CHART_FILL}
							dataset={bend.feesCumulative}
							charts={BEND_FEES_CHART}
							chartOptions={DOLLAR_CHART_OPTIONS}
							exportButtons={AREA_CHART_EXPORTS}
							valueSymbol="$"
						/>
					</Suspense>
				</Panel>
			)}

			{isLoading ? (
				<PanelLoadingStatus className="min-h-[400px]" />
			) : (
				<Panel>
					<Suspense fallback={<ChartPanelExportShellLoading />}>
						<MultiSeriesChart
							title="Cumulative revenue"
							headingAs="h3"
							containerClassName={CHART_FILL}
							dataset={bend.revenueCumulative}
							charts={BEND_REVENUE_CHART}
							chartOptions={DOLLAR_CHART_OPTIONS}
							exportButtons={AREA_CHART_EXPORTS}
							valueSymbol="$"
						/>
					</Suspense>
				</Panel>
			)}
		</div>
	)
}
