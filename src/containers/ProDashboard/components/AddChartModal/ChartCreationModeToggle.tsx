import { SegmentedControl } from '~/ui/SegmentedControl'
import { MAX_MULTI_CHART_SERIES } from '../../types'

const MODE_OPTIONS = [
	{ value: 'combined', label: 'One chart' },
	{ value: 'separate', label: 'Separate cards' }
] as const

interface ChartCreationModeToggleProps {
	chartCreationMode: 'separate' | 'combined'
	seriesCount: number
	onChartCreationModeChange: (mode: 'separate' | 'combined') => void
}

export function ChartCreationModeToggle({
	chartCreationMode,
	seriesCount,
	onChartCreationModeChange
}: ChartCreationModeToggleProps) {
	return (
		<div className="flex shrink-0 flex-wrap items-center gap-2">
			<SegmentedControl
				label="Chart layout"
				variant="default"
				size="sm"
				options={MODE_OPTIONS}
				value={chartCreationMode}
				onValueChange={onChartCreationModeChange}
			/>
			{chartCreationMode === 'combined' && seriesCount > MAX_MULTI_CHART_SERIES ? (
				<span className="body-sm text-tertiary">max {MAX_MULTI_CHART_SERIES} series</span>
			) : null}
		</div>
	)
}
