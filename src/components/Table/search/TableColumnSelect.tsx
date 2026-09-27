import { useSelector } from '@tanstack/react-store'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { getColumnSelectState, getColumnVisibilityForSelection } from './columnSelect'
import { useSearchTableContext } from './context'

export function TableColumnSelect() {
	const table = useSearchTableContext()
	const visibility = useSelector(table.atoms.columnVisibility)
	const columns = table.getAllLeafColumns()
	const { options, selected } = getColumnSelectState(columns, visibility)
	return (
		<SelectWithCombobox
			allValues={options}
			selectedValues={selected}
			setSelectedValues={(update) => {
				const next = typeof update === 'function' ? update(selected) : update
				table.setColumnVisibility(getColumnVisibilityForSelection(columns, next))
			}}
			nestedMenu={false}
			label="Columns"
			labelType="smol"
			variant="filter"
			size="md"
		/>
	)
}
