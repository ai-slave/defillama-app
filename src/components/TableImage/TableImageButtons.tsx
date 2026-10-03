import * as Ariakit from '@ariakit/react'
import { useCallback, useState, useSyncExternalStore, type ReactNode } from 'react'
import toast from 'react-hot-toast'
import {
	CsvDownloadDialogs,
	downloadPreparedCsv,
	type PrepareCsv,
	useCsvDownload
} from '~/components/CsvDownloadButton'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { MenuItem, MenuSurface } from '~/ui/MenuSurface'
import { popoverMenuItemStyles } from '~/ui/Popover'
import { copyTableImage, downloadTableImage, type TableImageInput } from './renderTableImage'

export type TableImageSource = () => Omit<TableImageInput, 'isDark'> | null

const WATERMARK_KEY = 'defillama-table-image-watermark'
const watermarkListeners = new Set<() => void>()

function readWatermarkPref(): boolean {
	try {
		return window.localStorage.getItem(WATERMARK_KEY) !== 'off'
	} catch {
		return true
	}
}

export function setTableImageWatermark(enabled: boolean): void {
	try {
		window.localStorage.setItem(WATERMARK_KEY, enabled ? 'on' : 'off')
	} catch {
		// A blocked storage still updates the in-memory subscribers below.
	}
	for (const listener of watermarkListeners) listener()
}

export function useTableImageWatermark(): [boolean, () => void] {
	const enabled = useSyncExternalStore(
		(listener) => {
			watermarkListeners.add(listener)
			return () => watermarkListeners.delete(listener)
		},
		readWatermarkPref,
		() => true
	)
	return [enabled, () => setTableImageWatermark(!enabled)]
}

export function readTableRows(table: HTMLTableElement | null): Array<Array<string>> {
	if (!table) return []
	const rows: Array<Array<string>> = []
	for (const row of Array.from(table.querySelectorAll('tr'))) {
		const cells = Array.from(row.querySelectorAll('th, td'))
		if (cells.length === 0) continue
		rows.push(cells.map((cell) => (cell.textContent ?? '').trim()))
	}
	return rows
}

export function headingAbove(table: HTMLElement | null): string | undefined {
	if (!table) return undefined
	let node: Element | null = table.parentElement?.previousElementSibling ?? table.previousElementSibling
	while (node) {
		if (/^H[1-6]$/.test(node.tagName)) return node.textContent?.trim() || undefined
		node = node.previousElementSibling
	}
	return undefined
}

export function readColumnWidths(table: HTMLTableElement | null): Array<number | null> | undefined {
	const cols = table ? Array.from(table.querySelectorAll('colgroup col')) : []
	if (cols.length === 0) return undefined
	const widths = cols.map((col) => {
		const raw = (col as HTMLTableColElement).style.width
		const parsed = raw ? Number.parseFloat(raw) : Number.NaN
		return Number.isFinite(parsed) ? parsed : null
	})
	return widths.some((width) => width !== null) ? widths : undefined
}

const DEFAULT_TRIGGER_CLASS =
	'flex items-center justify-center gap-1 rounded-md border border-medium px-2 py-1.5 text-xs text-secondary hover:bg-hover-row focus-visible:bg-hover-row disabled:opacity-50'

export function TableImageButtons({
	getSource,
	className,
	disabled = false,
	buttonClassName = DEFAULT_TRIGGER_CLASS,
	iconOnly = false,
	triggerContent,
	triggerLabel,
	prepareCsv,
	watermarkMode = 'always',
	hideWatermarkItem = false
}: {
	getSource: TableImageSource
	className?: string
	disabled?: boolean
	buttonClassName?: string
	iconOnly?: boolean
	/** Replaces the icon + label entirely, for toolbars with their own typographic language. */
	triggerContent?: ReactNode
	/** Overrides the trigger's text. Use a verb when the menu does more than PNG. */
	triggerLabel?: string
	/** Adds a "Download CSV" item on top, gated like CSVDownloadButton. */
	prepareCsv?: PrepareCsv
	/** 'always' keeps attribution on reader surfaces; 'preference' lets authors turn it off. */
	watermarkMode?: 'always' | 'preference'
	/** Keeps the export on the preference while the caller renders its own watermark control. */
	hideWatermarkItem?: boolean
}) {
	const [isDarkMode] = useDarkModeManager()
	const [watermarkEnabled, toggleWatermark] = useTableImageWatermark()
	const [isLoading, setIsLoading] = useState(false)
	const menu = Ariakit.useMenuStore()
	const csv = useCsvDownload()

	const run = useCallback(
		async (mode: 'download' | 'copy') => {
			if (isLoading || disabled) return
			const source = getSource()
			if (!source || source.rows.length === 0) {
				toast.error('Nothing to export')
				return
			}
			// Decided before the try: a conditional cannot be lowered inside one, nor inside the catch.
			const watermark = watermarkMode === 'always' ? true : watermarkEnabled
			const failureMessage = mode === 'copy' ? 'Could not copy the image' : 'Could not create the image'
			setIsLoading(true)
			try {
				const input: TableImageInput = { ...source, isDark: !!isDarkMode, watermark }
				if (mode === 'download') {
					await downloadTableImage(input)
				} else {
					await copyTableImage(input)
					toast.success('Image copied')
				}
			} catch (error) {
				toast.error(failureMessage)
				console.log(error)
			}
			setIsLoading(false)
		},
		[disabled, getSource, isDarkMode, isLoading, watermarkEnabled, watermarkMode]
	)

	return (
		<div className={className ?? 'flex flex-nowrap items-center gap-2'}>
			<Ariakit.MenuProvider store={menu}>
				<Ariakit.MenuButton
					className={buttonClassName}
					disabled={disabled || isLoading}
					title="Export table as image"
					aria-label="Export table as image"
				>
					{isLoading ? (
						<LoadingSpinner size={14} />
					) : (
						(triggerContent ?? <Icon name="download-paper" height={14} width={14} />)
					)}
					{triggerContent || iconOnly ? null : <span>{triggerLabel ?? '.png'}</span>}
				</Ariakit.MenuButton>

				<MenuSurface variant="actions" aria-label="Export table" gutter={8}>
					{prepareCsv ? (
						<MenuItem
							disabled={csv.userLoading || csv.status === 'pending'}
							data-umami-event="export-csv"
							onClick={() => csv.requestDownload(() => downloadPreparedCsv(prepareCsv))}
						>
							<Icon name="download-paper" height={14} width={14} />
							<span>Download CSV</span>
						</MenuItem>
					) : null}
					<MenuItem
						disabled={disabled || isLoading}
						data-umami-event="export-table-png"
						onClick={() => void run('download')}
					>
						<Icon name="download-paper" height={14} width={14} />
						<span>Download image</span>
					</MenuItem>
					<MenuItem disabled={disabled || isLoading} data-umami-event="copy-table-png" onClick={() => void run('copy')}>
						<Icon name="copy" height={14} width={14} />
						<span>Copy image</span>
					</MenuItem>
					{watermarkMode === 'preference' && !hideWatermarkItem ? (
						<Ariakit.MenuItemCheckbox
							name="watermark"
							checked={watermarkEnabled}
							onChange={toggleWatermark}
							hideOnClick={false}
							className={`${popoverMenuItemStyles} border-t border-medium`}
						>
							<Icon
								name={watermarkEnabled ? 'checkmark' : 'box'}
								height={14}
								width={14}
								className={watermarkEnabled ? '' : 'opacity-40'}
							/>
							<span>Include watermark</span>
						</Ariakit.MenuItemCheckbox>
					) : null}
				</MenuSurface>
			</Ariakit.MenuProvider>
			{prepareCsv ? <CsvDownloadDialogs controller={csv} /> : null}
		</div>
	)
}
