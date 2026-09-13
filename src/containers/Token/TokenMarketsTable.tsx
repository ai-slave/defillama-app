import type { ComponentProps } from 'react'
import { TableColumnSelect } from '~/components/Table/search/TableColumnSelect'
import { TableCsvExport } from '~/components/Table/search/TableCsvExport'
import { TableSearchInput } from '~/components/Table/search/TableSearchInput'
import { VirtualSearchTableView } from '~/components/Table/search/VirtualSearchTableView'
import { PairTable } from '~/containers/Exchanges/PairTable'
import { TableToolbar } from '~/ui/Toolbar'

export function TokenMarketsTable(
	props: Omit<
		ComponentProps<typeof PairTable>,
		'children' | 'leadingControls' | 'header' | 'columnToSearch' | 'placeholder'
	>
) {
	return (
		<PairTable {...props}>
			<div className="col-start-1 row-start-2 min-w-0 self-center sm:col-start-2 sm:row-start-1 sm:[&_label]:mr-0 sm:[&_label]:ml-auto">
				<TableToolbar className="w-full justify-end">
					<TableSearchInput columnId="venue" placeholder="Search exchanges..." />
					<TableColumnSelect />
					<TableCsvExport filename={props.csvFileName} includeHiddenColumns />
				</TableToolbar>
			</div>
			<div className="col-span-full row-start-3 min-w-0 sm:row-start-2">
				<VirtualSearchTableView />
			</div>
		</PairTable>
	)
}
