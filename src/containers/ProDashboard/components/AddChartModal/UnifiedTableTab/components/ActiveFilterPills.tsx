import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'

export interface FilterPill {
	id: string
	label: string
	onRemove: () => void
}

interface ActiveFilterPillsProps {
	pills: Array<FilterPill>
}

export function ActiveFilterPills({ pills }: ActiveFilterPillsProps) {
	if (pills.length === 0) {
		return <p className="text-xs text-pro-text-tertiary">No filters applied yet.</p>
	}

	return (
		<div className="flex flex-wrap gap-2">
			{pills.map((pill) => (
				<Button key={pill.id} variant="filter" size="sm" data-active="true" onClick={pill.onRemove}>
					<span className="sr-only">Remove filter </span>
					<span className="max-w-[140px] truncate">{pill.label}</span>
					<Icon name="x" className="size-3.5" aria-hidden="true" />
				</Button>
			))}
		</div>
	)
}
