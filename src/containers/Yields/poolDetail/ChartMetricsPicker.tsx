// "Add Metrics" picker: the shared metrics dialog, and the selected series as removable chips beside it.
import { ChartMetricsDialog, type ChartMetricOption as SharedChartMetricOption } from '~/components/ChartMetricsDialog'
import { neighbourRowControl, passFocusOnLeave } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { metricChipStyles } from '~/ui/MetricChip'
import { SealGlyph } from '../Tables/Measured'

export interface ChartMetricOption extends SharedChartMetricOption {
	/** The series default, so removing a metric clears the URL override instead of pinning one. */
	defaultEnabled: boolean
	/** Marks our own measurement with the seal. */
	verified?: boolean
}

export interface ChartMetricGroup {
	label: string
	options: Array<ChartMetricOption>
}

export function ChartMetricsPicker({
	groups,
	onToggle,
	onUnlock
}: {
	groups: Array<ChartMetricGroup>
	onToggle: (option: ChartMetricOption) => void
	/** Opens the upgrade path for a locked option. */
	onUnlock?: () => void
}) {
	const options = groups.flatMap((group) => group.options)
	if (options.length === 0) return null
	const selected = options.filter((option) => option.active && !option.locked)

	return (
		<>
			<ChartMetricsDialog
				groups={groups.map((group) => ({
					label: group.label,
					options: group.options.map((option) => ({
						...option,
						leading: option.verified ? <SealGlyph size={12} /> : null
					}))
				}))}
				onToggle={onToggle}
				onUnlock={onUnlock}
			/>

			{selected.map((option) => (
				<button
					key={option.key}
					type="button"
					onClick={() => onToggle(option)}
					// The chip leaves once the chart drops its series. It hands focus to the next chip, else the previous one,
					// which for the first chip is the Add Metrics button.
					ref={passFocusOnLeave((chip) => neighbourRowControl(chip, chip))}
					className={metricChipStyles}
					style={{ borderColor: option.color }}
				>
					{option.verified ? <SealGlyph size={14} className="mr-1 text-verified" /> : null}
					<span>{option.label}</span>
					<Icon name="x" className="size-4" />
					<span className="sr-only">Remove {option.label}</span>
				</button>
			))}
		</>
	)
}
