import { lazy, Suspense, useMemo, useState } from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { ChartRestoreButton } from '~/components/ChartExport/ChartRestoreButton'
import { EQUITIES_TREEMAP_COLORS } from '~/components/ECharts/TreemapChart/Market/colors'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { useSeriesSelection } from '~/hooks/useSeriesSelection'
import defs from '~/public/equities-definitions.json'
import { Button, buttonStyles } from '~/ui/Button'
import { Panel } from '~/ui/Panel'
import { TableToolbar, TableToolbarControlGroup } from '~/ui/Toolbar'
import { buildEquityTickerCountrySlug } from './tickerCountry'
import {
	buildEquitiesTreemapLeaves,
	EQUITIES_TREEMAP_COLOR_METRICS,
	EQUITIES_TREEMAP_DEFAULT_LIMIT,
	EQUITIES_TREEMAP_SIZE_METRICS,
	groupEquitiesTreemapLeaves,
	prepareEquitiesTreemapCsv,
	rankEquitiesTreemapRows,
	type EquitiesTreemapColorMetric,
	type EquitiesTreemapGroupBy,
	type EquitiesTreemapSizeMetric
} from './treemapData'
import type { IEquitiesListCompanyRow } from './types'

const MarketTreemapChart = lazy(() => import('~/components/ECharts/TreemapChart/Market'))

const CHART_HEIGHT = '600px'
const EXPORT_FILENAME = 'equities-market-map'
const CHART_ACTION_BUTTON_CLASSNAME = buttonStyles({ size: 'sm' })

const GROUP_OPTIONS: Array<{ key: EquitiesTreemapGroupBy; label: string }> = [
	{ key: 'sector', label: 'Sector' },
	{ key: 'none', label: 'Flat' }
]

const COLOR_METRIC_LABELS: Record<EquitiesTreemapColorMetric, string> = {
	priceChangePercentage1d: 'Price 1D',
	priceChangePercentage7d: 'Price 7D',
	priceChangePercentage1m: 'Price 1M'
}

const COLOR_OPTIONS = EQUITIES_TREEMAP_COLOR_METRICS.map((key) => ({ key, label: COLOR_METRIC_LABELS[key] }))

function getMetricLabel(metric: EquitiesTreemapSizeMetric): string {
	return (defs as Record<string, { label?: string }>)[metric]?.label ?? metric
}

const SIZE_METRIC_OPTIONS = EQUITIES_TREEMAP_SIZE_METRICS.map((metric) => ({
	key: metric,
	name: getMetricLabel(metric)
}))

export function EquitiesTreemapSection({ companies }: { companies: IEquitiesListCompanyRow[] }) {
	const [groupBy, setGroupBy] = useState<EquitiesTreemapGroupBy>('sector')
	const [sizeMetric, setSizeMetric] = useState<EquitiesTreemapSizeMetric>('marketCap')
	const [colorMetric, setColorMetric] = useState<EquitiesTreemapColorMetric>('priceChangePercentage1d')
	const { chartInstance, handleChartReady } = useGetChartInstance()

	const ranking = useMemo(() => rankEquitiesTreemapRows(companies, sizeMetric, 0), [companies, sizeMetric])
	const companyOptions = useMemo(
		() =>
			ranking.rows.map((company) => ({
				key: buildEquityTickerCountrySlug(company.ticker, company.country),
				name: `${company.ticker} — ${company.name}`
			})),
		[ranking.rows]
	)
	const companyTickers = useMemo(() => companyOptions.map((company) => company.key), [companyOptions])
	const defaultCompanies = useMemo(() => companyTickers.slice(0, EQUITIES_TREEMAP_DEFAULT_LIMIT), [companyTickers])
	const {
		activeSeries: selectedCompanies,
		selectedCharts: selectedCompanySet,
		setSelectedSeries: setSelectedCompanies
	} = useSeriesSelection({
		availableSeries: companyTickers,
		defaultSeries: defaultCompanies,
		maxSelectedSeries: EQUITIES_TREEMAP_DEFAULT_LIMIT,
		allowEmptySelection: true,
		resetToDefaultWhenStale: true,
		selectionKey: 'equities-market-map'
	})
	const visibleRanking = useMemo(
		() => ({
			...ranking,
			rows: ranking.rows.filter((company) =>
				selectedCompanySet.has(buildEquityTickerCountrySlug(company.ticker, company.country))
			),
			truncatedCount: ranking.rows.length - selectedCompanies.length
		}),
		[ranking, selectedCompanies.length, selectedCompanySet]
	)
	const leaves = useMemo(() => buildEquitiesTreemapLeaves(visibleRanking, colorMetric), [colorMetric, visibleRanking])
	const treeData = useMemo(() => groupEquitiesTreemapLeaves(leaves, groupBy), [groupBy, leaves])
	const { excludedCount } = ranking

	const sizeLabel = getMetricLabel(sizeMetric)
	const colorLabel = COLOR_METRIC_LABELS[colorMetric]
	const chartNote = [
		excludedCount > 0 ? `${excludedCount} companies hidden (zero, negative or missing ${sizeLabel})` : '',
		ranking.rows.length > leaves.length
			? `showing ${leaves.length} of ${ranking.rows.length} eligible companies by ${sizeLabel}`
			: ''
	]
		.filter(Boolean)
		.join(' · ')

	return (
		<Panel padding="none">
			<TableToolbar className="justify-between">
				<h2 className="label-md">Market Map</h2>
				<TableToolbarControlGroup className="ml-auto justify-end">
					<div className="flex items-center gap-1">
						<span className="text-sm text-secondary">Group</span>
						{GROUP_OPTIONS.map((option) => (
							<Button
								key={option.key}
								type="button"
								data-active={groupBy === option.key}
								variant="toggle"
								size="sm"
								onClick={() => setGroupBy(option.key)}
							>
								{option.label}
							</Button>
						))}
					</div>
					{companyOptions.length > 1 ? (
						<SelectWithCombobox
							allValues={companyOptions}
							selectedValues={selectedCompanies}
							setSelectedValues={setSelectedCompanies}
							label="Company"
							labelType="smol"
							variant="filter-responsive"
							size="sm"
						/>
					) : null}
					<SelectWithCombobox
						allValues={SIZE_METRIC_OPTIONS}
						selectedValues={[sizeMetric]}
						setSelectedValues={(values) => {
							const next = Array.isArray(values) ? values[0] : null
							if (next) setSizeMetric(next as EquitiesTreemapSizeMetric)
						}}
						label={`Size: ${sizeLabel}`}
						singleSelect
						nestedMenu={false}
						labelType="none"
						variant="filter-responsive"
						size="sm"
					/>
					<div className="flex items-center gap-1">
						<span className="text-sm text-secondary">Color</span>
						{COLOR_OPTIONS.map((option) => (
							<Button
								key={option.key}
								type="button"
								data-active={colorMetric === option.key}
								variant="toggle"
								size="sm"
								onClick={() => setColorMetric(option.key)}
							>
								{option.label}
							</Button>
						))}
					</div>
					{treeData.length > 0 ? (
						<>
							<ChartRestoreButton chartInstance={chartInstance} className={CHART_ACTION_BUTTON_CLASSNAME} />
							<ChartExportButtons
								chartInstance={chartInstance}
								className={CHART_ACTION_BUTTON_CLASSNAME}
								filename={EXPORT_FILENAME}
								title="Equities Market Map"
								prepareCsvDirect={() =>
									prepareEquitiesTreemapCsv({
										leaves,
										sizeLabel,
										colorLabel,
										filename: EXPORT_FILENAME
									})
								}
								pngProfile="treemapNormalized"
								smol
							/>
						</>
					) : null}
				</TableToolbarControlGroup>
			</TableToolbar>
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
			{treeData.length > 0 || chartNote ? (
				<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 pb-2 body-sm text-tertiary">
					{chartNote ? <p>{chartNote}</p> : null}
					{treeData.length > 0 ? (
						<div
							className="ml-auto w-40 shrink-0 text-xs"
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
			) : null}
		</Panel>
	)
}
