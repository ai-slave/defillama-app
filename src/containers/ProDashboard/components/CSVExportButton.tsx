import { CSVDownloadButton, type PrepareCsv } from '~/components/CsvDownloadButton'

interface CSVExportButtonBaseProps {
	smol?: boolean
	className?: string
}

type CSVExportButtonProps = CSVExportButtonBaseProps &
	(
		| { prepareCsv: PrepareCsv; onClick?: never; isLoading?: never }
		| { onClick: () => void; isLoading?: boolean; prepareCsv?: never }
	)

export function CSVExportButton({
	onClick,
	prepareCsv,
	smol = false,
	isLoading = false,
	className
}: CSVExportButtonProps) {
	const resolvedClassName =
		className ??
		'flex items-center gap-2 rounded-md border pro-border pro-hover-bg pro-panel-bg px-3 py-1.5 text-sm text-pro-text-primary transition-colors disabled:cursor-not-allowed disabled:opacity-50'
	if (prepareCsv) {
		return <CSVDownloadButton prepareCsv={prepareCsv} className={resolvedClassName} replaceClassName smol={smol} />
	}
	return (
		<CSVDownloadButton
			onClick={onClick}
			className={resolvedClassName}
			replaceClassName
			smol={smol}
			isLoading={isLoading}
		/>
	)
}
