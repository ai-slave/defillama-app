import { CSVDownloadButton } from '~/components/CsvDownloadButton'

/** A Pro dataset toolbar's CSV export: Button md, level with the toolbar's other md controls. */
export function CSVExportButton({ onClick, smol = false }: { onClick: () => void | Promise<void>; smol?: boolean }) {
	return <CSVDownloadButton size="md" onClick={onClick} isLoading={false} smol={smol} />
}
