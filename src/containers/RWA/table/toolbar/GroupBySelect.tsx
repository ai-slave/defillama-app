import { Select } from '~/components/Select/Select'
import {
	getRwaGroupByLabel,
	getRwaGroupByOptions,
	type RWAGroupBy,
	type RWAGroupByScope,
	type RWATableView
} from '../groupBy'

export function RWATableGroupBySelect({
	view,
	scope,
	value,
	onChange
}: {
	view: RWATableView
	scope: RWAGroupByScope
	value: RWAGroupBy
	onChange: (groupBy: RWAGroupBy) => void
}) {
	const options = getRwaGroupByOptions(view, { scope })
	return (
		<Select
			allValues={options}
			selectedValues={value}
			setSelectedValues={(next: string) => {
				const groupBy = options.find((option) => option.key === next)?.key
				if (groupBy) onChange(groupBy)
			}}
			label={`Group by: ${getRwaGroupByLabel(value, view)}`}
			labelType="none"
			variant="filter"
			size="md"
		/>
	)
}
