import { Select } from '~/ui/Select'
import type { RWAPageKind } from '../../layout/pageLayout'
import { getRwaGroupByLabel, getRwaGroupByOptions, type RWAGroupBy } from '../groupBy'

export function RWATableGroupBySelect({
	pageKind,
	value,
	onChange
}: {
	pageKind: RWAPageKind
	value: RWAGroupBy
	onChange: (groupBy: RWAGroupBy) => void
}) {
	const options = getRwaGroupByOptions(pageKind)
	return (
		<Select
			heading="Group by"
			allValues={options}
			selectedValues={value}
			setSelectedValues={(next: string) => {
				const groupBy = options.find((option) => option.key === next)?.key
				if (groupBy) onChange(groupBy)
			}}
			label={`Group by: ${getRwaGroupByLabel(value, pageKind)}`}
			labelType="none"
			variant="filter"
			size="md"
		/>
	)
}
