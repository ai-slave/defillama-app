import { Icon } from '~/components/Icon'

export interface FilterPill {
	id: string
	label: string
	onRemove: () => void
}

interface ActiveFilterPillsProps {
	pills: FilterPill[]
}

export function ActiveFilterPills({ pills }: ActiveFilterPillsProps) {
	if (pills.length === 0) {
		return <p className="text-[11px] text-pro-text-tertiary">No filters applied yet.</p>
	}

	return (
		<div className="flex flex-wrap gap-2">
			{pills.map((pill) => (
				<button
					type="button"
					key={pill.id}
					onClick={pill.onRemove}
					className="group flex items-center gap-1 rounded-full border border-pro-cards-border px-3 py-1 text-[11px] font-medium text-pro-text-secondary transition hover:border-brand hover:text-brand"
					aria-label={`Remove filter ${pill.label}`}
				>
					<span className="max-w-[140px] truncate">{pill.label}</span>
					<Icon name="x" height={10} width={10} className="text-pro-text-tertiary group-hover:text-brand" />
				</button>
			))}
		</div>
	)
}
