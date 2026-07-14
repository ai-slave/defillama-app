import { lazy, Suspense, useMemo, useState } from 'react'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import defs from '~/public/equities-definitions.json'
import { Button } from '~/ui/Button'
import { Panel } from '~/ui/Panel'
import { TableToolbar, TableToolbarControlGroup } from '~/ui/Toolbar'
import { filterEquityCompanies, type EquityActiveFilter } from './filters'
import {
	buildEquitiesTreemap,
	EQUITIES_TREEMAP_COLOR_METRICS,
	EQUITIES_TREEMAP_DEFAULT_LIMIT,
	EQUITIES_TREEMAP_SIZE_METRICS,
	type EquitiesTreemapColorMetric,
	type EquitiesTreemapGroupBy,
	type EquitiesTreemapSizeMetric
} from './treemapData'
import type { IEquitiesListCompanyRow } from './types'

const EquitiesTreemapChart = lazy(() => import('~/components/ECharts/EquitiesTreemapChart'))

const CHART_HEIGHT = '600px'

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

export function EquitiesTreemapSection({
	companies,
	filters
}: {
	companies: IEquitiesListCompanyRow[]
	filters: EquityActiveFilter[]
}) {
	const [groupBy, setGroupBy] = useState<EquitiesTreemapGroupBy>('sector')
	const [sizeMetric, setSizeMetric] = useState<EquitiesTreemapSizeMetric>('marketCap')
	const [colorMetric, setColorMetric] = useState<EquitiesTreemapColorMetric>('priceChangePercentage1d')

	const filteredCompanies = useMemo(() => filterEquityCompanies(companies, filters), [companies, filters])

	const { treeData, excludedCount, truncatedCount } = useMemo(
		() => buildEquitiesTreemap(filteredCompanies, { groupBy, sizeMetric, colorMetric }),
		[colorMetric, filteredCompanies, groupBy, sizeMetric]
	)

	const sizeLabel = getMetricLabel(sizeMetric)
	const colorLabel = COLOR_METRIC_LABELS[colorMetric]

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
				</TableToolbarControlGroup>
			</TableToolbar>
			<Suspense fallback={<div style={{ height: CHART_HEIGHT }} />}>
				<EquitiesTreemapChart
					treeData={treeData}
					sizeLabel={sizeLabel}
					colorLabel={colorLabel}
					valueSymbol={sizeMetric === 'employeeCount' ? '' : '$'}
					height={CHART_HEIGHT}
					showMarketCapRow={sizeMetric !== 'marketCap'}
				/>
			</Suspense>
			{excludedCount > 0 || truncatedCount > 0 ? (
				<p className="px-3 pb-2 body-sm text-tertiary">
					{[
						excludedCount > 0 ? `${excludedCount} companies hidden (zero, negative or missing ${sizeLabel})` : '',
						truncatedCount > 0
							? `showing top ${EQUITIES_TREEMAP_DEFAULT_LIMIT} by ${sizeLabel} (${truncatedCount} more not shown)`
							: ''
					]
						.filter(Boolean)
						.join(' · ')}
				</p>
			) : null}
		</Panel>
	)
}
