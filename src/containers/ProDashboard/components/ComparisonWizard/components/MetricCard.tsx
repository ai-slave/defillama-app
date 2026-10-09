import { CheckboxIndicator } from '~/ui/Checkbox'
import { OptionTile } from '~/ui/OptionTile'
import type { MetricWithAvailability } from '../types'

interface MetricCardProps {
	metric: MetricWithAvailability
	isSelected: boolean
	onToggle: () => void
	itemLabel: string
}

export function MetricCard({ metric, isSelected, onToggle, itemLabel }: MetricCardProps) {
	return (
		// The whole card is the checkbox, so the box inside is only its indicator.
		<OptionTile
			layout="row"
			selected={isSelected}
			role="checkbox"
			aria-checked={isSelected}
			onClick={onToggle}
			disabled={!metric.isValid}
			className="group"
		>
			<CheckboxIndicator checked={isSelected} className="group-disabled:border-disabled" />

			<span className="min-w-0 flex-1">
				<span className="block label-md text-primary group-disabled:text-disabled">{metric.title}</span>
				<span className="flex items-center gap-1.5 body-sm text-tertiary group-disabled:text-disabled">
					<span className="capitalize">{metric.chartType}</span>
					<span aria-hidden>•</span>
					<span className={metric.isValid ? 'text-secondary' : 'text-error'}>
						{metric.availableCount}/{metric.totalCount} {itemLabel}
					</span>
				</span>
			</span>
		</OptionTile>
	)
}
