import { Select } from '~/components/Select/Select'
import type { ChartControlsModel } from '~/containers/LlamaAI/utils/chartCapabilities'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { capitalizeFirstLetter } from '~/utils'
import { trackUmamiEvent } from '~/utils/analytics/umami'

const CUMULATIVE_DISPLAY_OPTIONS = [
	{ name: 'Show individual values', key: 'Individual' },
	{ name: 'Show cumulative values', key: 'Cumulative' }
]

const STACKING_DISPLAY_OPTIONS = [
	{ name: 'Show separate', key: 'Separate' },
	{ name: 'Show stacked', key: 'Stacked' }
]

const VALUE_TYPE_OPTIONS = [
	{ name: 'Show absolute ($)', key: '$ Absolute' },
	{ name: 'Show percentage (%)', key: '% Percentage' }
]

const HALLMARK_OPTIONS = [
	{ name: 'Show hallmarks', key: 'Show Hallmarks' },
	{ name: 'Hide hallmarks', key: 'Hide Hallmarks' }
]

const LABEL_OPTIONS = [
	{ name: 'Show labels', key: 'Show' },
	{ name: 'Hide labels', key: 'Hide' }
]

const SCALE_OPTIONS = [
	{ name: 'Linear scale', key: 'Linear' },
	{ name: 'Log scale', key: 'Log' }
]

interface ChartControlsProps {
	controls: ChartControlsModel
	onStackedChange: (stacked: boolean) => void
	onPercentageChange: (percentage: boolean) => void
	onCumulativeChange: (cumulative: boolean) => void
	onGroupingChange: (grouping: 'day' | 'week' | 'month' | 'quarter' | 'year') => void
	onHallmarksChange: (showHallmarks: boolean) => void
	onLabelsChange: (showLabels: boolean) => void
	onLogScaleChange: (logScale: boolean) => void
	onOpenStyleEditor?: () => void
	children?: React.ReactNode
}

export function ChartControls({
	controls,
	onStackedChange,
	onPercentageChange,
	onCumulativeChange,
	onGroupingChange,
	onHallmarksChange,
	onLabelsChange,
	onLogScaleChange,
	onOpenStyleEditor,
	children
}: ChartControlsProps) {
	const hasControls =
		controls.showGrouping ||
		controls.showCumulative ||
		controls.showStack ||
		controls.showPercentage ||
		controls.showHallmarks ||
		controls.showLabels ||
		controls.showLogScale

	if (!hasControls && !children && !controls.title) return null

	return (
		<div className="flex flex-wrap items-center justify-end gap-1.5 border-b border-subtle p-2 pt-0">
			{controls.title ? (
				<p className="mr-auto min-w-0 truncate heading-xs text-primary" title={controls.title}>
					{controls.title}
				</p>
			) : null}
			{controls.showGrouping ? (
				<SegmentedControl
					label="Grouping"
					variant="default"
					size="md"
					value={controls.state.grouping}
					onValueChange={(interval) => {
						trackUmamiEvent('llamaai-chart-control', { control: 'grouping', selection: interval })
						onGroupingChange(interval)
					}}
					options={controls.groupingOptions.map((interval) => ({
						value: interval,
						label: interval.slice(0, 1).toUpperCase(),
						ariaLabel: capitalizeFirstLetter(interval),
						tooltip: capitalizeFirstLetter(interval),
						disabled: controls.groupingLocked && interval !== 'day'
					}))}
				/>
			) : null}

			{controls.groupingLocked ? (
				onOpenStyleEditor ? (
					<Button type="button" size="md" onClick={onOpenStyleEditor}>
						<Icon name="settings" className="size-3.5" />
						Set series aggregation to enable W/M/Q/Y
					</Button>
				) : (
					<span className="body-sm whitespace-nowrap text-tertiary">
						W/M/Q/Y unavailable: series aggregation not set
					</span>
				)
			) : null}

			{controls.showCumulative ? (
				<Select
					heading="Display"
					size="md"
					allValues={CUMULATIVE_DISPLAY_OPTIONS}
					selectedValues={controls.state.cumulative ? 'Cumulative' : 'Individual'}
					setSelectedValues={(value: string) => {
						trackUmamiEvent('llamaai-chart-control', { control: 'cumulative', selection: value })
						onCumulativeChange(value === 'Cumulative')
						if (value === 'Cumulative') {
							onStackedChange(false)
						}
					}}
					label={controls.state.cumulative ? 'Cumulative' : 'Individual'}
					labelType="none"
					variant="filter"
				/>
			) : null}

			{controls.showStack ? (
				<Select
					heading="Stacking"
					size="md"
					allValues={STACKING_DISPLAY_OPTIONS}
					selectedValues={controls.state.stacked ? 'Stacked' : 'Separate'}
					setSelectedValues={(value: string) => {
						trackUmamiEvent('llamaai-chart-control', { control: 'stacking', selection: value })
						const isStacked = value === 'Stacked'
						onStackedChange(isStacked)
					}}
					label={controls.state.stacked ? 'Stacked' : 'Separate'}
					labelType="none"
					variant="filter"
				/>
			) : null}

			{controls.showPercentage ? (
				<Select
					heading="Values"
					size="md"
					allValues={VALUE_TYPE_OPTIONS}
					selectedValues={controls.state.percentage ? '% Percentage' : '$ Absolute'}
					setSelectedValues={(value: string) => {
						trackUmamiEvent('llamaai-chart-control', { control: 'value-type', selection: value })
						onPercentageChange(value === '% Percentage')
					}}
					label={controls.state.percentage ? '% Percentage' : '$ Absolute'}
					labelType="none"
					variant="filter"
				/>
			) : null}

			{controls.showLogScale ? (
				<Select
					heading="Scale"
					size="md"
					allValues={SCALE_OPTIONS}
					selectedValues={controls.state.logScale ? 'Log' : 'Linear'}
					setSelectedValues={(value: string) => {
						trackUmamiEvent('llamaai-chart-control', { control: 'scale', selection: value })
						onLogScaleChange(value === 'Log')
					}}
					label={controls.state.logScale ? 'Scale: Log' : 'Scale: Linear'}
					labelType="none"
					variant="filter"
				/>
			) : null}

			{controls.showHallmarks ? (
				<Select
					heading="Hallmarks"
					size="md"
					allValues={HALLMARK_OPTIONS}
					selectedValues={controls.state.showHallmarks ? 'Show Hallmarks' : 'Hide Hallmarks'}
					setSelectedValues={(value: string) => {
						trackUmamiEvent('llamaai-chart-control', { control: 'hallmarks', selection: value })
						onHallmarksChange(value === 'Show Hallmarks')
					}}
					label={controls.state.showHallmarks ? 'Hallmarks: On' : 'Hallmarks: Off'}
					labelType="none"
					variant="filter"
				/>
			) : null}

			{controls.showLabels ? (
				<Select
					heading="Labels"
					size="md"
					allValues={LABEL_OPTIONS}
					selectedValues={controls.state.showLabels ? 'Show' : 'Hide'}
					setSelectedValues={(value: string) => {
						trackUmamiEvent('llamaai-chart-control', { control: 'labels', selection: value })
						onLabelsChange(value === 'Show')
					}}
					label={controls.state.showLabels ? 'Labels: On' : 'Labels: Off'}
					labelType="none"
					variant="filter"
				/>
			) : null}
			{children}
		</div>
	)
}
