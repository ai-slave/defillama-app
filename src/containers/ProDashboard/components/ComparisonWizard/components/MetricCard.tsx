import { Icon } from '~/ui/Icon'
import type { MetricWithAvailability } from '../types'

interface MetricCardProps {
	metric: MetricWithAvailability
	isSelected: boolean
	onToggle: () => void
	disabled?: boolean
	itemLabel?: string
}

export function MetricCard({ metric, isSelected, onToggle, disabled, itemLabel = 'items' }: MetricCardProps) {
	const isDisabled = disabled || !metric.isValid

	return (
		<button
			type="button"
			onClick={onToggle}
			disabled={isDisabled}
			className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-all ${
				isSelected
					? 'border-brand bg-brand/5 ring-1 ring-brand/20'
					: isDisabled
						? 'cursor-not-allowed border-pro-cards-border opacity-50'
						: 'border-pro-cards-border bg-pro-cards-bg hover:border-brand/40'
			}`}
		>
			<div
				className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-sm border transition-colors ${
					isSelected ? 'border-brand bg-brand' : 'border-pro-form-control-border bg-surface-elevated-1'
				}`}
			>
				{isSelected ? <Icon name="check" height={10} width={10} className="text-on-brand" /> : null}
			</div>

			<div className="min-w-0 flex-1">
				<span className="text-sm font-medium text-pro-text-primary">{metric.title}</span>
				<div className="flex items-center gap-1.5 text-xs text-pro-text-tertiary">
					<span className="capitalize">{metric.chartType}</span>
					<span>•</span>
					<span className={metric.isValid ? 'text-pro-text-secondary' : 'text-error'}>
						{metric.availableCount}/{metric.totalCount} {itemLabel}
					</span>
				</div>
			</div>
		</button>
	)
}
