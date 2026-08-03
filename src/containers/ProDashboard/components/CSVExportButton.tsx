import { CSVDownloadButton } from '~/components/CsvDownloadButton'

export function CSVExportButton({
	onClick,
	smol = false,
	isLoading = false,
	className
}: {
	onClick: () => void
	smol?: boolean
	isLoading?: boolean
	className?: string
}) {
	return (
		<CSVDownloadButton
			onClick={onClick}
			className={
				className ??
				'flex items-center gap-2 rounded-md border pro-border pro-hover-bg pro-panel-bg px-3 py-1.5 text-sm text-pro-text-primary transition-colors disabled:cursor-not-allowed disabled:opacity-50'
			}
			replaceClassName
			smol={smol}
			isLoading={isLoading}
		/>
	)
}
