import { useSelector } from '@tanstack/react-store'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { useSearchTableContext } from './context'

export function TableColumnSelect({ label = 'Columns' }: { label?: string }) {
	const table = useSearchTableContext()
	const visibility = useSelector(table.atoms.columnVisibility)
	const columns = table.getAllLeafColumns()
	const options = columns
		.filter((column) => !column.columnDef.meta?.hidden)
		.map((column) => ({
			key: column.id,
			name: typeof column.columnDef.header === 'function' ? column.id : (column.columnDef.header ?? column.id),
			...(column.columnDef.meta?.headerHelperText ? { help: column.columnDef.meta.headerHelperText } : {})
		}))
	const selected = columns
		.filter((column) => visibility[column.id] !== false && !column.columnDef.meta?.hidden)
		.map((column) => column.id)
	return (
		<SelectWithCombobox
			allValues={options}
			selectedValues={selected}
			setSelectedValues={(update) => {
				const next = typeof update === 'function' ? update(selected) : update
				const selectedIds = new Set(next)
				table.setColumnVisibility(Object.fromEntries(columns.map((column) => [column.id, selectedIds.has(column.id)])))
			}}
			nestedMenu={false}
			label={label}
			labelType="smol"
			variant="filter-responsive"
			size="md"
		/>
	)
}
