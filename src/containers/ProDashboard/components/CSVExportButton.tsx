import { CSVDownloadButton, type PrepareCsv } from '~/components/CsvDownloadButton'

interface CSVExportButtonBaseProps {
	smol?: boolean
	className?: string
	disabled?: boolean
}

type CSVExportButtonProps = CSVExportButtonBaseProps &
	(
		| { prepareCsv: PrepareCsv; onClick?: never; isLoading?: never }
		| { onClick: () => void | Promise<void>; isLoading?: boolean; prepareCsv?: never }
	)

export function CSVExportButton({
	onClick,
	prepareCsv,
	smol = false,
	isLoading = false,
	className,
	disabled
}: CSVExportButtonProps) {
	const resolvedClassName =
		className ??
		'flex items-center gap-2 rounded-md border pro-border pro-hover-bg pro-panel-bg px-3 py-1.5 text-sm text-pro-text-primary transition-colors disabled:cursor-not-allowed disabled:opacity-50'
	if (prepareCsv) {
		return (
			<CSVDownloadButton
				disabled={disabled}
				prepareCsv={prepareCsv}
				className={resolvedClassName}
				replaceClassName
				smol={smol}
			/>
		)
	}
	return (
		<CSVDownloadButton
			disabled={disabled}
			onClick={onClick}
			className={resolvedClassName}
			replaceClassName
			smol={smol}
			isLoading={isLoading}
		/>
	)
}
