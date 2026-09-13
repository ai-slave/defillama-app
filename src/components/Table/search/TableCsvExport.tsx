import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { prepareTableCsv } from '../utils'
import { useSearchTableContext } from './context'

export function TableCsvExport({
	filename,
	includeHiddenColumns = false
}: {
	filename: string
	includeHiddenColumns?: boolean
}) {
	const table = useSearchTableContext()
	return (
		<CSVDownloadButton
			prepareCsv={() => prepareTableCsv({ instance: table, filename, includeHiddenColumns })}
			smol
			size="md"
		/>
	)
}
