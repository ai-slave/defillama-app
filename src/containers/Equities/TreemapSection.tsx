import { useRouter } from 'next/router'
import { lazy, Suspense, useCallback, useMemo, type ReactNode } from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { ChartRestoreButton } from '~/components/ChartExport/ChartRestoreButton'
import { EQUITIES_TREEMAP_COLORS } from '~/components/ECharts/TreemapChart/Market/colors'
import { useLocalSelection } from '~/components/Select/localSelection'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import defs from '~/public/equities-definitions.json'
import { ChartPanelBodyFallback } from '~/ui/ChartPanel'
import { LoadingSpinner } from '~/ui/Loaders'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { TableToolbar, TableToolbarControlGroup } from '~/ui/Toolbar'
import { pushShallowQuery } from '~/utils/routerQuery'
import { useEquitiesTreemapDataset } from './queries.client'
import { buildEquitiesTreemapQueryString } from './tableQuery'
import { buildEquityTickerCountrySlug } from './tickerCountry'
import {
	buildEquitiesTreemapLeaves,
	EQUITIES_TREEMAP_COLOR_METRICS,
	EQUITIES_TREEMAP_DEFAULT_LIMIT,
	EQUITIES_TREEMAP_SIZE_METRICS,
	groupEquitiesTreemapLeaves,
	prepareCompleteEquitiesTreemapCsv,
	type EquitiesTreemapColorMetric,
	type EquitiesTreemapGroupBy,
	type EquitiesTreemapSizeMetric,
	type IEquitiesTreemapRanking
} from './treemapData'
import {
	EQUITIES_TREEMAP_QUERY_KEYS,
	getEquitiesTreemapQueryValue,
	parseEquitiesTreemapState,
	type EquitiesTreemapState
} from './treemapState'
import type { EquitiesTreemapRow } from './types'

const MarketTreemapChart = lazy(() => import('~/components/ECharts/TreemapChart/Market'))

const CHART_HEIGHT = '600px'
const EXPORT_FILENAME = 'equities-market-map'
const NO_ROWS: Array<EquitiesTreemapRow> = []

const GROUP_OPTIONS: Array<{ value: EquitiesTreemapGroupBy; label: string }> = [
	{ value: 'sector', label: 'Sector' },
	{ value: 'none', label: 'Flat' }
]

const COLOR_METRIC_LABELS: Record<EquitiesTreemapColorMetric, string> = {
	priceChangePercentage1d: 'Price 1D',
	priceChangePercentage7d: 'Price 7D',
	priceChangePercentage1m: 'Price 1M'
}

const COLOR_OPTIONS = EQUITIES_TREEMAP_COLOR_METRICS.map((value) => ({ value, label: COLOR_METRIC_LABELS[value] }))

function getMetricLabel(metric: EquitiesTreemapSizeMetric): string {
	return (defs as Record<string, { label?: string }>)[metric]?.label ?? metric
}

const SIZE_METRIC_OPTIONS = EQUITIES_TREEMAP_SIZE_METRICS.map((metric) => ({
	key: metric,
	name: getMetricLabel(metric)
}))

export function EquitiesTreemapSection({
	sharedControls,
	filterPills
}: {
	sharedControls: ReactNode
	filterPills: ReactNode
}) {
	const router = useRouter()
	const { groupBy, sizeMetric, colorMetric } = parseEquitiesTreemapState(router.query)
	const { chartInstance, handleChartReady } = useGetChartInstance()
	// Static page: router.query is empty until hydration, so wait for it before asking for a filtered map.
	const queryString = router.isReady
		? buildEquitiesTreemapQueryString({
				query: router.query as Record<string, string | Array<string> | undefined>,
				sizeMetric
			})
		: null
	const datasetQuery = useEquitiesTreemapDataset(queryString)
	const data = datasetQuery.data

	const setTreemapQuery = useCallback(
		<K extends keyof EquitiesTreemapState>(key: K, value: EquitiesTreemapState[K]) => {
			void pushShallowQuery(router, { [EQUITIES_TREEMAP_QUERY_KEYS[key]]: getEquitiesTreemapQueryValue(key, value) })
		},
		[router]
	)

	// Rows arrive ranked by size metric and capped server-side; the picker narrows within that set.
	const rankedRows = data?.rows ?? NO_ROWS
	const companyOptions = useMemo(
		() =>
			rankedRows.map((company) => ({
				key: buildEquityTickerCountrySlug(company.ticker, company.country),
				name: `${company.ticker} — ${company.name}`
			})),
		[rankedRows]
	)
	const companyTickers = useMemo(() => companyOptions.map((company) => company.key), [companyOptions])
	const {
		activeSeries: selectedCompanies,
		selectedCharts: selectedCompanySet,
		setSelectedSeries: setSelectedCompanies
	} = useLocalSelection({
		availableSeries: companyTickers,
		defaultSeries: companyTickers,
		maxSelectedSeries: EQUITIES_TREEMAP_DEFAULT_LIMIT,
		allowEmptySelection: true,
		scope: 'equities-market-map'
	})
	const ranking = useMemo<IEquitiesTreemapRanking>(
		() => ({
			rows: rankedRows.filter((company) =>
				selectedCompanySet.has(buildEquityTickerCountrySlug(company.ticker, company.country))
			),
			sizeMetric,
			excludedCount: data?.excludedCount ?? 0,
			truncatedCount: rankedRows.length - selectedCompanies.length
		}),
		[data?.excludedCount, rankedRows, selectedCompanies.length, selectedCompanySet, sizeMetric]
	)
	const leaves = useMemo(() => buildEquitiesTreemapLeaves(ranking, colorMetric), [colorMetric, ranking])
	const treeData = useMemo(() => groupEquitiesTreemapLeaves(leaves, groupBy), [groupBy, leaves])

	const sizeLabel = getMetricLabel(sizeMetric)
	const colorLabel = COLOR_METRIC_LABELS[colorMetric]
	const eligibleCount = data ? data.total - data.excludedCount : 0
	const chartNote = [
		ranking.excludedCount > 0
			? `${ranking.excludedCount} companies hidden (zero, negative or missing ${sizeLabel})`
			: '',
		eligibleCount > leaves.length
			? `showing ${leaves.length} of ${eligibleCount} eligible companies by ${sizeLabel}`
			: ''
	]
		.filter(Boolean)
		.join(' · ')

	return (
		<>
			<TableToolbar>
				{sharedControls}
				<TableToolbarControlGroup>
					<SegmentedControl
						value={groupBy}
						onValueChange={(next) => setTreemapQuery('groupBy', next)}
						options={GROUP_OPTIONS}
						label="Group companies"
						variant="default"
						size="md"
					/>
					{companyOptions.length > 1 ? (
						<SelectWithCombobox
							allValues={companyOptions}
							selectedValues={selectedCompanies}
							setSelectedValues={setSelectedCompanies}
							label="Company"
							labelType="smol"
							variant="filter"
							size="md"
						/>
					) : null}
					<SelectWithCombobox
						heading="Size by"
						allValues={SIZE_METRIC_OPTIONS}
						selectedValues={[sizeMetric]}
						setSelectedValues={(values) => {
							const next = values[0] as EquitiesTreemapSizeMetric | undefined
							if (next) setTreemapQuery('sizeMetric', next)
						}}
						label={`Size: ${sizeLabel}`}
						singleSelect
						nestedMenu={false}
						labelType="none"
						variant="filter"
						size="md"
					/>
					<SegmentedControl
						value={colorMetric}
						onValueChange={(next) => setTreemapQuery('colorMetric', next)}
						options={COLOR_OPTIONS}
						label="Color metric"
						variant="default"
						size="md"
					/>
					{treeData.length > 0 ? (
						<>
							<ChartRestoreButton chartInstance={chartInstance} />
							<ChartExportButtons
								chartInstance={chartInstance}
								filename={EXPORT_FILENAME}
								title="Equities Market Map"
								csvSource={{
									type: 'prepare-csv',
									prepare: () =>
										prepareCompleteEquitiesTreemapCsv({
											ranking,
											colorMetric,
											sizeLabel,
											colorLabel,
											filename: EXPORT_FILENAME
										})
								}}
								pngProfile="treemapNormalized"
								smol
							/>
						</>
					) : null}
				</TableToolbarControlGroup>
			</TableToolbar>
			{filterPills}
			{data == null ? (
				<ChartPanelBodyFallback
					role={datasetQuery.isError ? 'alert' : 'status'}
					className={datasetQuery.isError ? 'body-sm text-data-down' : undefined}
					style={{ height: CHART_HEIGHT }}
				>
					{datasetQuery.isError ? 'Chart unavailable' : <LoadingSpinner size={24} />}
				</ChartPanelBodyFallback>
			) : rankedRows.length === 0 ? (
				<ChartPanelBodyFallback className="body-sm text-tertiary" style={{ height: CHART_HEIGHT }}>
					No companies match the current filters
				</ChartPanelBodyFallback>
			) : (
				<>
					<Suspense fallback={<div style={{ height: CHART_HEIGHT }} />}>
						<MarketTreemapChart
							treeData={treeData}
							leaves={leaves}
							sizeLabel={sizeLabel}
							colorLabel={colorLabel}
							valueSymbol={sizeMetric === 'employeeCount' ? '' : '$'}
							height={CHART_HEIGHT}
							showMarketCapRow={sizeMetric !== 'marketCap'}
							onReady={handleChartReady}
						/>
					</Suspense>
					<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 pb-2 body-sm text-tertiary">
						{chartNote ? <p>{chartNote}</p> : null}
						{treeData.length > 0 ? (
							<div
								className="ml-auto w-40 shrink-0 body-sm"
								role="img"
								aria-label={`Treemap color scale: loss through zero to gain for ${colorLabel}`}
							>
								<div
									className="h-1.5 rounded-full border border-subtle"
									style={{
										background: `linear-gradient(to right, ${EQUITIES_TREEMAP_COLORS.negative}, ${EQUITIES_TREEMAP_COLORS.neutral}, ${EQUITIES_TREEMAP_COLORS.positive})`
									}}
								/>
								<div className="flex justify-between pt-0.5">
									<span>Loss</span>
									<span>0%</span>
									<span>Gain</span>
								</div>
							</div>
						) : null}
					</div>
				</>
			)}
		</>
	)
}
