// "Add Metrics" picker: the shared metrics dialog, and the selected series as removable chips beside it.
import { ChartMetricsDialog, type ChartMetricOption as SharedChartMetricOption } from '~/components/ChartMetricsDialog'
import { Icon } from '~/ui/Icon'
import { MetricChip } from '~/ui/MetricChip'

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
						leading: option.verified ? (
							<Icon name="badge-check" className="size-3.5 shrink-0 text-verified" aria-hidden />
						) : null
					}))
				}))}
				onToggle={onToggle}
				onUnlock={onUnlock}
			/>

			{selected.map((option) => (
				<MetricChip
					key={option.key}
					label={option.label}
					color={option.color}
					onRemove={() => onToggle(option)}
					prefix={
						option.verified ? (
							<Icon name="badge-check" className="mr-1 size-4 shrink-0 text-verified" aria-hidden />
						) : null
					}
				/>
			))}
		</>
	)
}
