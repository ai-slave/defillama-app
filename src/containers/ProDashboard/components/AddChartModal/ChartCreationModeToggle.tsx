import { useId } from 'react'
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
	/** What Add still needs (an edit keeps one card), shown under the toggle once Add was pressed. */
	error: string | null
}

export function ChartCreationModeToggle({
	chartCreationMode,
	seriesCount,
	onChartCreationModeChange,
	error
}: ChartCreationModeToggleProps) {
	const errorId = `${useId()}-error`
	return (
		<div data-invalid={error ? '' : undefined} className="flex shrink-0 flex-col gap-1">
			<div className="flex flex-wrap items-center gap-2">
				<SegmentedControl
					label="Chart layout"
					variant="default"
					size="sm"
					options={MODE_OPTIONS}
					value={chartCreationMode}
					onValueChange={onChartCreationModeChange}
					aria-describedby={error ? errorId : undefined}
				/>
				{chartCreationMode === 'combined' && seriesCount > MAX_MULTI_CHART_SERIES ? (
					<span className="body-sm text-tertiary">max {MAX_MULTI_CHART_SERIES} series</span>
				) : null}
			</div>
			{error ? (
				<p id={errorId} className="body-sm text-error">
					{error}
				</p>
			) : null}
		</div>
	)
}
