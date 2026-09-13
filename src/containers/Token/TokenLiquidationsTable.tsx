import type { RowData } from '@tanstack/react-table'
import { SearchTableProvider, type SearchTableOptions } from '~/components/Table/search/SearchTableProvider'
import { TableCsvExport } from '~/components/Table/search/TableCsvExport'
import { TableSearchInput } from '~/components/Table/search/TableSearchInput'
import { VirtualSearchTableView } from '~/components/Table/search/VirtualSearchTableView'
import { LiquidationsTableContent } from '~/containers/LiquidationsV2/TableTabs'
import { TableToolbar } from '~/ui/Toolbar'

export function TokenLiquidationsTable<T extends RowData>({
	options,
	placeholder,
	csvFileName
}: {
	options: SearchTableOptions<T>
	placeholder: string
	csvFileName: string
}) {
	return (
		<SearchTableProvider options={options}>
			<LiquidationsTableContent
				toolbar={
					<TableToolbar className="w-full justify-end">
						<TableSearchInput columnId="name" placeholder={placeholder} />
						<TableCsvExport filename={csvFileName} />
					</TableToolbar>
				}
			>
				<VirtualSearchTableView />
			</LiquidationsTableContent>
		</SearchTableProvider>
	)
}
