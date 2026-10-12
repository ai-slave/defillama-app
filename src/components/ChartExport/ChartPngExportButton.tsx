import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import toast from 'react-hot-toast'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { MenuItem, MenuSurface } from '~/ui/PopoverSurface'
import { BusyGlyph } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import type { CsvCell } from '~/utils/csvCell'
import { downloadCSV } from '~/utils/download'
import type { PngExportProfile } from './chartPngExport'
import type { ChartExportHandle } from './types'
import { useChartPngExport } from './useChartPngExport'
export * from './chartPngExport'
// --- Component ---

interface ChartPngExportButtonProps {
	chart: Pick<ChartExportHandle, 'chartInstance'>
	smol?: boolean | undefined
	disabled?: boolean | undefined
	title?: string | undefined
	filename?: string | undefined
	iconUrl?: string | undefined
	expandLegend?: boolean | undefined
	pngProfile?: PngExportProfile | undefined
	onExport?: ((info: { kind: 'download' | 'copy'; filename: string }) => void) | undefined
	/** Consolidated export menu: icon-only disclosure with a "Download CSV" item on top
	 * of the image actions. Used by the LlamaAI chat toolbar; other pages keep the
	 * separate .csv/.png buttons. */
	csvMenuItem?: { prepareCsv: () => { filename: string; rows: Array<Array<CsvCell>> } } | undefined
	iconOnly?: boolean | undefined
}

// Called out to because a conditional cannot be lowered inside the try that guards prepareCsv.
function withCsvExtension(filename: string) {
	return filename.endsWith('.csv') ? filename : `${filename}.csv`
}

export function ChartPngExportButton({
	chart,
	smol = true,
	disabled = false,
	title,
	filename,
	iconUrl,
	expandLegend,
	pngProfile = 'default',
	onExport,
	csvMenuItem,
	iconOnly = false
}: ChartPngExportButtonProps) {
	const router = useRouter()
	const menu = Ariakit.useMenuStore({ placement: 'bottom-end' })
	const {
		isExporting: isLoading,
		downloadImage,
		copyImage
	} = useChartPngExport({
		chartInstance: chart.chartInstance,
		title,
		filename,
		iconUrl,
		expandLegend,
		pngProfile,
		onExport
	})
	const handleDownload = () => {
		if (disabled || isLoading) return
		downloadImage()
	}
	const handleCopyToClipboard = () => {
		if (disabled || isLoading) return
		copyImage()
	}

	const exportLabel = csvMenuItem ? 'Export chart' : 'Export chart as image'

	return (
		<Ariakit.MenuProvider store={menu}>
			<Tooltip
				content={exportLabel}
				render={
					<Ariakit.MenuButton
						store={menu}
						disabled={disabled}
						aria-label={iconOnly ? exportLabel : undefined}
						// The menu hands focus back here as the export starts; a pending Button keeps it.
						render={
							<Button
								size="md"
								square={iconOnly}
								pending={isLoading}
								// A label would reserve "Exporting…" beside .png on every toolbar; the text button swaps its icon instead.
								pendingLabel={iconOnly ? 'Exporting…' : undefined}
							/>
						}
					/>
				}
			>
				{isLoading && !iconOnly ? (
					<BusyGlyph decorative size={14} />
				) : (
					<Icon name="download-paper" className="size-3.5" />
				)}
				{iconOnly ? null : <span>{smol ? '.png' : 'Image'}</span>}
			</Tooltip>

			<MenuSurface variant="actions" gutter={8}>
				{csvMenuItem ? (
					<MenuItem
						data-umami-event="export-csv"
						disabled={disabled || isLoading}
						data-umami-event-page={router.pathname}
						onClick={() => {
							try {
								const { filename: csvFilename, rows } = csvMenuItem.prepareCsv()
								downloadCSV(withCsvExtension(csvFilename), rows, { addTimestamp: false })
							} catch {
								toast.error("Couldn't export the CSV.")
							}
						}}
					>
						<Icon name="download-paper" className="size-3.5" />
						<span>Download CSV</span>
					</MenuItem>
				) : null}
				<MenuItem
					data-umami-event="export-image"
					disabled={disabled || isLoading}
					data-umami-event-page={router.pathname}
					onClick={handleDownload}
				>
					<Icon name="download-paper" className="size-3.5" />
					<span>Download image</span>
				</MenuItem>
				<MenuItem
					data-umami-event="copy-image"
					disabled={disabled || isLoading}
					data-umami-event-page={router.pathname}
					onClick={handleCopyToClipboard}
				>
					<Icon name="copy" className="size-3.5" />
					<span>Copy to clipboard</span>
				</MenuItem>
			</MenuSurface>
		</Ariakit.MenuProvider>
	)
}
