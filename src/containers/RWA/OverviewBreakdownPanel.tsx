import { useMemo, type ReactNode } from 'react'
import { Select } from '~/components/Select/Select'
import type { IRWAAssetsOverview, RWAChartMetricKey } from './api.types'
import type { RwaChartAxis } from './chartBreakdown'
import {
	getTreemapNestedByLabel,
	getTreemapNestedByOptions,
	type RWAChartView,
	type RwaTreemapNestedBy
} from './chartState'
import { buildRwaBreakdownSlices } from './hooks'
import { RWASnapshotChartPanel } from './SnapshotChartPanel'
import { buildRwaNestedTreemapTreeData, canBuildRwaNestedTreemap } from './treemap'

/** Pie and flat treemap slices per axis, Others included: the chain pie stays small, every category keeps its own slice. */
const PIE_LIMITS: Record<RwaChartAxis, number> = {
	chain: 10,
	category: Number.POSITIVE_INFINITY,
	assetName: 24,
	assetGroup: 24,
	platform: 24
}

export type RWAOverviewBreakdownPanelProps = {
	view: Exclude<RWAChartView, 'timeSeries' | 'share'>
	/** The axis the table's Group by maps to; the treemap nests below it. */
	axis: RwaChartAxis
	metric: RWAChartMetricKey
	metricLabel: string
	groupLabel: string
	exportTitle: string
	filename: string
	treemapNestedBy: RwaTreemapNestedBy
	onTreemapNestedByChange: (nestedBy: RwaTreemapNestedBy) => void
	assets: IRWAAssetsOverview['assets']
	selectedCategories: Array<string>
	includeBridgeTvl: boolean
	/** The metric switch and the view select, shared with the time series panel. */
	toolbarStart: ReactNode
}

/** The pie, treemap and bar views of the Assets chart: one slice per group of the table's Group by. */
export function RWAOverviewBreakdownPanel({
	view,
	axis,
	metric,
	metricLabel,
	groupLabel,
	exportTitle,
	filename,
	treemapNestedBy,
	onTreemapNestedByChange,
	assets,
	selectedCategories,
	includeBridgeTvl,
	toolbarStart
}: RWAOverviewBreakdownPanelProps) {
	const slices = useMemo(
		() => buildRwaBreakdownSlices({ axis, assets, metric, selectedCategories, includeBridgeTvl }),
		[axis, assets, metric, selectedCategories, includeBridgeTvl]
	)
	const isNestedTreemapSupported = canBuildRwaNestedTreemap({ parentGrouping: axis, childGrouping: treemapNestedBy })
	const nestedTreemap = useMemo(
		() =>
			view === 'treemap' && isNestedTreemapSupported
				? buildRwaNestedTreemapTreeData({
						assets,
						metric,
						rootLabel: groupLabel,
						parentGrouping: axis,
						childGrouping: treemapNestedBy,
						includeBridgeTvl
					})
				: [],
		[view, isNestedTreemapSupported, assets, metric, groupLabel, axis, treemapNestedBy, includeBridgeTvl]
	)
	const treemapNestedByOptions = getTreemapNestedByOptions(axis)

	return (
		<RWASnapshotChartPanel
			view={view}
			slices={slices}
			valueSymbol="$"
			valueLabel={metricLabel}
			groupLabel={groupLabel}
			exportTitle={exportTitle}
			filename={filename}
			isLoading={false}
			error={null}
			toolbarStart={toolbarStart}
			pieLimit={PIE_LIMITS[axis]}
			treemapLimit={PIE_LIMITS[axis]}
			nestedTreemap={nestedTreemap}
			treemapControls={
				<Select
					heading="Nested by"
					allValues={treemapNestedByOptions}
					selectedValues={treemapNestedBy}
					setSelectedValues={(value: string) => {
						const selectedNestedBy = treemapNestedByOptions.find((option) => option.key === value)?.key
						if (!selectedNestedBy) throw new Error(`Unknown RWA treemap grouping: ${value}`)
						onTreemapNestedByChange(selectedNestedBy)
					}}
					label={`Nested by: ${getTreemapNestedByLabel(treemapNestedBy)}`}
					labelType="none"
					variant="filter"
					size="md"
				/>
			}
		/>
	)
}
