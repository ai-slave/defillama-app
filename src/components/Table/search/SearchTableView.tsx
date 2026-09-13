import type { RowData } from '@tanstack/react-table'
import type { SearchTableFeatures } from '../features/search'
import { Table, type TableProps } from '../Table'
import { useSearchTableContext } from './context'

export function SearchTableView(props: Omit<TableProps<SearchTableFeatures, RowData>, 'table'>) {
	const table = useSearchTableContext()
	return <Table table={table} {...props} />
}
