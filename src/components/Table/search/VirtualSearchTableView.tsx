import type { RowData } from '@tanstack/react-table'
import type { SearchTableFeatures } from '../features/search'
import type { TableProps } from '../Table'
import { VirtualTable } from '../VirtualTable'
import { useSearchTableContext } from './context'

export function VirtualSearchTableView(props: Omit<TableProps<SearchTableFeatures, RowData>, 'table'>) {
	const table = useSearchTableContext()
	return <VirtualTable table={table} {...props} />
}
