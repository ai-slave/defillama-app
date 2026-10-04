import { lazy, Suspense, useMemo } from 'react'
import { useAuthContext } from '~/auth'
import { VirtualizedSelect, type VirtualizedSelectOption } from '~/components/Select/VirtualizedSelect'
import { CHART_COLORS } from '~/constants/colors'
import {
	useRWAAssetChartData,
	useRWAAssetsList,
	useRWABreakdownChartData,
	useRWAChainsList
} from '~/containers/ProDashboard/components/datasets/RWADataset/useRWAChartData'
import { isRwaTotalSeriesLabel } from '~/containers/RWA/chartAggregation'
import { getChartMetricOptions, getChartViewOptions, getChartMetricLabel } from '~/containers/RWA/chartState'
import { ChartPanelBodyFallback } from '~/ui/ChartPanel'
import { SurfaceBodyLoadingStatus, SurfaceBodyStatus } from '~/ui/Status'
import { formatUsd } from '~/utils/numberFormat'
import type { RWAOverviewChartBreakdown, RWAOverviewChartMetric, RWAOverviewChartView } from '../../types'
import { PremiumFeatureGate } from '../PremiumFeatureGate'
import { buildProRwaAssetChartSeries } from '../rwaAssetChart'
import { buildRwaSnapshotPresentation } from '../rwaSnapshot'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))
const PieChart = lazy(() => import('~/components/ECharts/PieChart'))
const HBarChart = lazy(() => import('~/components/ECharts/HBarChart'))
const TreemapChart = lazy(() => import('~/components/ECharts/TreemapChart'))

const EMPTY_RWA_SNAPSHOT_ITEMS: Array<{ name: string; value: number }> = []
const EMPTY_RWA_BAR_DATA = { categories: [], values: [] }

interface RWAChartTabProps {
	rwaMode: 'overview' | 'asset'
	selectedRwaChain: string
	selectedRwaMetric: RWAOverviewChartMetric
	selectedRwaChartView: RWAOverviewChartView
	selectedRwaBreakdown: RWAOverviewChartBreakdown
	selectedRwaTreemapNestedBy: string
	selectedRwaAssetId: string | null
	selectedRwaAssetName: string | null
	selectedRwaAssetMetrics: Array<RWAOverviewChartMetric>
	onRwaModeChange: (mode: 'overview' | 'asset') => void
	onSelectedRwaChainChange: (chain: string) => void
	onSelectedRwaMetricChange: (metric: RWAOverviewChartMetric) => void
	onSelectedRwaChartViewChange: (view: RWAOverviewChartView) => void
	onSelectedRwaBreakdownChange: (breakdown: RWAOverviewChartBreakdown) => void
	onSelectedRwaTreemapNestedByChange: (nestedBy: string) => void
	onSelectedRwaAssetIdChange: (id: string | null) => void
	onSelectedRwaAssetNameChange: (name: string | null) => void
	onSelectedRwaAssetMetricsChange: (metrics: Array<RWAOverviewChartMetric>) => void
}

const BREAKDOWN_OPTIONS: Array<VirtualizedSelectOption<RWAOverviewChartBreakdown>> = [
	{ value: 'chain', label: 'Chain' },
	{ value: 'category', label: 'Category' },
	{ value: 'platform', label: 'Platform' },
	{ value: 'assetGroup', label: 'Asset Group' }
]

const ALL_METRICS: Array<RWAOverviewChartMetric> = ['activeMcap', 'onChainMcap', 'defiActiveTvl']

const METRIC_LABELS: Record<RWAOverviewChartMetric, string> = {
	activeMcap: 'Active AUM',
	onChainMcap: 'Onchain AUM',
	defiActiveTvl: 'DeFi Active TVL'
}

const RWA_METRIC_OPTIONS: Array<VirtualizedSelectOption<RWAOverviewChartMetric>> = getChartMetricOptions().map(
	(option) => ({
		value: option.key,
		label: option.label
	})
)
// The share view belongs to the /rwa page; the dashboard card has no share renderer.
const RWA_CHART_VIEW_OPTIONS: Array<VirtualizedSelectOption<RWAOverviewChartView>> = getChartViewOptions().flatMap(
	(option) => (option.key === 'share' ? [] : [{ value: option.key, label: option.name }])
)

export function RWAChartTab(props: RWAChartTabProps) {
	const { hasActiveSubscription } = useAuthContext()

	if (!hasActiveSubscription) {
		return (
			<PremiumFeatureGate featureName="RWA Charts" paywallReason="pro-feature">
				{null}
			</PremiumFeatureGate>
		)
	}

	return <RWAChartTabInner {...props} />
}

function RWAChartTabInner({
	rwaMode,
	selectedRwaChain,
	selectedRwaMetric,
	selectedRwaChartView,
	selectedRwaBreakdown,
	selectedRwaTreemapNestedBy: _selectedRwaTreemapNestedBy,
	selectedRwaAssetId,
	selectedRwaAssetName,
	selectedRwaAssetMetrics,
	onRwaModeChange,
	onSelectedRwaChainChange,
	onSelectedRwaMetricChange,
	onSelectedRwaChartViewChange,
	onSelectedRwaBreakdownChange,
	onSelectedRwaTreemapNestedByChange: _onSelectedRwaTreemapNestedByChange,
	onSelectedRwaAssetIdChange,
	onSelectedRwaAssetNameChange,
	onSelectedRwaAssetMetricsChange
}: RWAChartTabProps) {
	const { chains: rwaChains } = useRWAChainsList()

	const chainOptions = useMemo(() => {
		const opts = [{ value: 'All', label: 'All chains' }]
		for (const { chain, tvl } of rwaChains) {
			opts.push({
				value: chain,
				label: `${chain} (${formatUsd(tvl, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })})`
			})
		}
		return opts
	}, [rwaChains])

	const metricOptions = RWA_METRIC_OPTIONS
	const chartViewOptions = RWA_CHART_VIEW_OPTIONS

	const isChainSpecific = selectedRwaChain && selectedRwaChain !== 'All'

	return (
		<div className="flex flex-col gap-4">
			<div className="space-y-3">
				<div className="flex rounded-md border border-pro-cards-border p-0.5">
					<button
						type="button"
						onClick={() => onRwaModeChange('overview')}
						className={`flex-1 rounded-sm px-3 py-1.5 text-xs font-medium transition-all ${
							rwaMode === 'overview'
								? 'bg-pro-cards-bg text-pro-text-primary shadow-sm'
								: 'text-pro-text-secondary hover:text-pro-text-primary'
						}`}
					>
						Chain
					</button>
					<button
						type="button"
						onClick={() => onRwaModeChange('asset')}
						className={`flex-1 rounded-sm px-3 py-1.5 text-xs font-medium transition-all ${
							rwaMode === 'asset'
								? 'bg-pro-cards-bg text-pro-text-primary shadow-sm'
								: 'text-pro-text-secondary hover:text-pro-text-primary'
						}`}
					>
						By asset
					</button>
				</div>
			</div>

			{rwaMode === 'overview' ? (
				<div className="flex flex-wrap gap-3">
					<VirtualizedSelect
						variant="field"
						label="Chain"
						placeholder="Select…"
						options={chainOptions}
						selectedValue={selectedRwaChain}
						onChange={(opt) => onSelectedRwaChainChange(opt.value)}
					/>
					<VirtualizedSelect
						variant="field"
						label="Metric"
						placeholder="Select…"
						options={metricOptions}
						selectedValue={selectedRwaMetric}
						onChange={(opt) => onSelectedRwaMetricChange(opt.value)}
					/>
					<VirtualizedSelect
						variant="field"
						label="Chart type"
						placeholder="Select…"
						options={chartViewOptions}
						selectedValue={selectedRwaChartView}
						onChange={(opt) => onSelectedRwaChartViewChange(opt.value)}
					/>
					{!isChainSpecific ? (
						<VirtualizedSelect
							variant="field"
							label="Breakdown"
							placeholder="Select…"
							options={BREAKDOWN_OPTIONS}
							selectedValue={selectedRwaBreakdown}
							onChange={(opt) => onSelectedRwaBreakdownChange(opt.value)}
						/>
					) : null}
				</div>
			) : (
				<AssetControls
					selectedAssetId={selectedRwaAssetId}
					selectedAssetName={selectedRwaAssetName}
					selectedMetrics={selectedRwaAssetMetrics}
					onAssetIdChange={onSelectedRwaAssetIdChange}
					onAssetNameChange={onSelectedRwaAssetNameChange}
					onMetricsChange={onSelectedRwaAssetMetricsChange}
				/>
			)}

			<div className="min-h-[320px] rounded-md border border-pro-cards-border bg-pro-cards-bg">
				{rwaMode === 'overview' ? (
					<OverviewPreview
						breakdown={selectedRwaBreakdown}
						metric={selectedRwaMetric}
						chartView={selectedRwaChartView}
						chain={selectedRwaChain}
					/>
				) : (
					<AssetPreview assetId={selectedRwaAssetId} metrics={selectedRwaAssetMetrics} />
				)}
			</div>
		</div>
	)
}

function AssetControls({
	selectedAssetId,
	selectedAssetName: _selectedAssetName,
	selectedMetrics,
	onAssetIdChange,
	onAssetNameChange,
	onMetricsChange
}: {
	selectedAssetId: string | null
	selectedAssetName: string | null
	selectedMetrics: Array<RWAOverviewChartMetric>
	onAssetIdChange: (id: string | null) => void
	onAssetNameChange: (name: string | null) => void
	onMetricsChange: (metrics: Array<RWAOverviewChartMetric>) => void
}) {
	const { assets, isLoading } = useRWAAssetsList()

	const assetOptions: Array<VirtualizedSelectOption> = useMemo(
		() =>
			assets.map((a) => ({
				value: a.id,
				label: a.assetName || a.ticker,
				description:
					a.totalActiveMcap !== null && a.totalActiveMcap > 0
						? formatUsd(a.totalActiveMcap, {
								compact: true,
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})
						: a.ticker
			})),
		[assets]
	)

	const handleAssetChange = (option: VirtualizedSelectOption) => {
		onAssetIdChange(option.value)
		onAssetNameChange(option.label)
	}

	const handleMetricToggle = (metric: RWAOverviewChartMetric) => {
		const isSelected = selectedMetrics.includes(metric)
		if (isSelected && selectedMetrics.length === 1) return
		if (isSelected) {
			onMetricsChange(selectedMetrics.filter((m) => m !== metric))
		} else {
			onMetricsChange([...selectedMetrics, metric])
		}
	}

	return (
		<div className="flex flex-col gap-3">
			<VirtualizedSelect
				variant="field"
				label="Select asset"
				options={assetOptions}
				selectedValue={selectedAssetId}
				onChange={handleAssetChange}
				placeholder={isLoading ? 'Loading assets…' : 'Search for an RWA asset…'}
			/>
			<div className="flex flex-wrap gap-2">
				<span className="text-sm text-pro-text-secondary">Metrics:</span>
				{ALL_METRICS.map((metric) => {
					const isSelected = selectedMetrics.includes(metric)
					return (
						<button
							type="button"
							key={metric}
							onClick={() => handleMetricToggle(metric)}
							className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
								isSelected
									? 'bg-brand text-on-brand'
									: 'border border-pro-cards-border text-pro-text-secondary hover:border-brand/40'
							}`}
						>
							{METRIC_LABELS[metric]}
						</button>
					)
				})}
			</div>
		</div>
	)
}

function OverviewPreview({
	breakdown,
	metric,
	chartView,
	chain
}: {
	breakdown: RWAOverviewChartBreakdown
	metric: RWAOverviewChartMetric
	chartView: RWAOverviewChartView
	chain?: string
}) {
	const { chartDataset, isLoading } = useRWABreakdownChartData(breakdown, metric, chain)
	const timeSeriesDataset = chartView === 'timeSeries' ? chartDataset : null
	const snapshot = useMemo(
		() =>
			chartDataset && chartView !== 'timeSeries'
				? buildRwaSnapshotPresentation({
						dataset: chartDataset,
						view: chartView,
						timePeriod: 'all',
						breakdownLabel: breakdown
					})
				: null,
		[breakdown, chartDataset, chartView]
	)
	const pieData = snapshot?.view === 'pie' ? snapshot.data : EMPTY_RWA_SNAPSHOT_ITEMS

	const pieColors = useMemo(() => {
		const colors: Record<string, string> = {}
		for (const [idx, item] of pieData.entries()) {
			colors[item.name] = CHART_COLORS[idx % CHART_COLORS.length] ?? CHART_COLORS[0]
		}
		return colors
	}, [pieData])

	const barData = snapshot?.view === 'hbar' ? snapshot : EMPTY_RWA_BAR_DATA
	const treemapData = snapshot?.view === 'treemap' ? snapshot.data : []

	if (isLoading || !chartDataset) {
		return <SurfaceBodyLoadingStatus />
	}

	return (
		<Suspense fallback={<ChartPanelBodyFallback />}>
			{chartView === 'timeSeries' && timeSeriesDataset ? (
				<MultiSeriesChart
					dataset={timeSeriesDataset}
					hideDefaultLegend={false}
					stacked
					showTotalInTooltip={!chartDataset.dimensions.some(isRwaTotalSeriesLabel)}
				/>
			) : chartView === 'pie' && pieData.length > 0 ? (
				<PieChart chartData={pieData} stackColors={pieColors} />
			) : chartView === 'hbar' && barData.categories.length > 0 ? (
				<HBarChart categories={barData.categories} values={barData.values} valueSymbol="$" />
			) : chartView === 'treemap' && treemapData.length > 0 ? (
				<TreemapChart treeData={treemapData} variant="rwa" height="320px" valueLabel={getChartMetricLabel(metric)} />
			) : (
				<SurfaceBodyStatus variant="empty">No data available</SurfaceBodyStatus>
			)}
		</Suspense>
	)
}

function AssetPreview({ assetId, metrics }: { assetId: string | null; metrics: Array<RWAOverviewChartMetric> }) {
	const { chartDataset, isLoading } = useRWAAssetChartData(assetId)
	const charts = useMemo(() => buildProRwaAssetChartSeries(chartDataset, metrics), [chartDataset, metrics])

	if (!assetId) {
		return <SurfaceBodyStatus variant="empty">Select an asset to see preview</SurfaceBodyStatus>
	}

	if (isLoading || !chartDataset) {
		return <SurfaceBodyLoadingStatus />
	}

	return (
		<Suspense fallback={<ChartPanelBodyFallback />}>
			<MultiSeriesChart dataset={chartDataset} charts={charts} hideDefaultLegend={false} />
		</Suspense>
	)
}
