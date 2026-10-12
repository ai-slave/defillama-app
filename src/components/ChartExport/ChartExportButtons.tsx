import { ChartCsvExportButton, type ChartCsvSource } from './ChartCsvExportButton'
import { ChartPngExportButton, type PngExportProfile } from './ChartPngExportButton'
import type { ChartExportHandle } from './types'

interface ChartExportButtonsProps {
	/** The handle the chart also takes as `exportButtons`, so the buttons export that chart. */
	chart: Pick<ChartExportHandle, 'chartInstance'>
	filename?: string | undefined
	title?: string | undefined
	iconUrl?: string | undefined
	expandLegend?: boolean | undefined
	smol?: boolean | undefined
	disabled?: boolean | undefined
	showCsv?: boolean | undefined
	showPng?: boolean | undefined
	/** Explicitly declares whether CSV reads the rendered chart, a lazy dataset, or specialized rows. */
	csvSource: ChartCsvSource | null
	pngProfile?: PngExportProfile | undefined
	onCsvExport?: ((info: { filename: string }) => void) | undefined
	onPngExport?: ((info: { kind: 'download' | 'copy'; filename: string }) => void) | undefined
}

export function ChartExportButtons({
	chart,
	filename,
	title,
	iconUrl,
	expandLegend,
	smol,
	disabled,
	showCsv = true,
	showPng = true,
	csvSource,
	pngProfile,
	onCsvExport,
	onPngExport
}: ChartExportButtonsProps) {
	// One unit, so .csv and .png wrap together instead of splitting across toolbar rows.
	return (
		<div className="flex items-center gap-1.5">
			{showCsv && csvSource ? (
				<ChartCsvExportButton
					chart={chart}
					filename={filename}
					smol={smol}
					disabled={disabled}
					source={csvSource}
					onExport={onCsvExport}
				/>
			) : null}
			{showPng ? (
				<ChartPngExportButton
					chart={chart}
					filename={filename}
					title={title}
					iconUrl={iconUrl}
					expandLegend={expandLegend}
					smol={smol}
					disabled={disabled}
					pngProfile={pngProfile}
					onExport={onPngExport}
				/>
			) : null}
		</div>
	)
}
