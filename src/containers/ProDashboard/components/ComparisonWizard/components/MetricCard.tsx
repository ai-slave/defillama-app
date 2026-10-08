import { CheckboxIndicator } from '~/ui/Checkbox'
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
		<button
			type="button"
			role="checkbox"
			aria-checked={isSelected}
			onClick={onToggle}
			disabled={!metric.isValid}
			className={`group flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:border-disabled disabled:bg-disabled ${
				isSelected ? 'border-brand bg-brand-faint' : 'border-subtle not-disabled:hover:border-brand-muted'
			}`}
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
		</button>
	)
}
