import * as Ariakit from '@ariakit/react'
import type * as echarts from 'echarts/core'
import { useRouter } from 'next/router'
import toast from 'react-hot-toast'
import { buttonStyles } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { MenuItem, MenuSurface } from '~/ui/MenuSurface'
import { Tooltip } from '~/ui/Tooltip'
import type { CsvCell } from '~/utils/csvCell'
import { downloadCSV } from '~/utils/download'
import type { PngExportProfile } from './chartPngExport'
import { useChartPngExport } from './useChartPngExport'
export * from './chartPngExport'
// --- Component ---

const DEFAULT_CLASSNAME = buttonStyles({ size: 'md' })

interface ChartPngExportButtonProps {
	chartInstance: () => echarts.ECharts | null
	className?: string | undefined
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
	chartInstance,
	className = DEFAULT_CLASSNAME,
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
	} = useChartPngExport({ chartInstance, title, filename, iconUrl, expandLegend, pngProfile, onExport })
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
						data-loading={isLoading}
						disabled={disabled || isLoading}
						aria-label={iconOnly ? exportLabel : undefined}
					/>
				}
				className={className}
			>
				{isLoading ? <LoadingSpinner size={14} /> : <Icon name="download-paper" height={14} width={14} />}
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
								toast.error('Failed to export CSV')
							}
						}}
					>
						<Icon name="download-paper" height={14} width={14} />
						<span>Download CSV</span>
					</MenuItem>
				) : null}
				<MenuItem
					data-umami-event="export-image"
					disabled={disabled || isLoading}
					data-umami-event-page={router.pathname}
					onClick={handleDownload}
				>
					<Icon name="download-paper" height={14} width={14} />
					<span>Download image</span>
				</MenuItem>
				<MenuItem
					data-umami-event="copy-image"
					disabled={disabled || isLoading}
					data-umami-event-page={router.pathname}
					onClick={handleCopyToClipboard}
				>
					<Icon name="copy" height={14} width={14} />
					<span>Copy to clipboard</span>
				</MenuItem>
			</MenuSurface>
		</Ariakit.MenuProvider>
	)
}
