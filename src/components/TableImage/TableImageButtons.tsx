import * as Ariakit from '@ariakit/react'
import { useCallback, useState, useSyncExternalStore, type ReactNode } from 'react'
import toast from 'react-hot-toast'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import {
	menuSurfaceStyles,
	popoverMenuItemStyles,
	popoverMobileDismissStyles,
	popoverMobileWrapperClassName
} from '~/ui/Popover'
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
	csvSlot,
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
	/** Rendered as the first menu item, so the caller keeps its own CSV gating and modals. */
	csvSlot?: ReactNode
	/** 'always' keeps attribution on reader surfaces; 'preference' lets authors turn it off. */
	watermarkMode?: 'always' | 'preference'
	/** Keeps the export on the preference while the caller renders its own watermark control. */
	hideWatermarkItem?: boolean
}) {
	const [isDarkMode] = useDarkModeManager()
	const [watermarkEnabled, toggleWatermark] = useTableImageWatermark()
	const [isLoading, setIsLoading] = useState(false)
	const popover = Ariakit.usePopoverStore()

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
			<Ariakit.PopoverProvider store={popover}>
				<Ariakit.PopoverDisclosure
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
				</Ariakit.PopoverDisclosure>

				<Ariakit.Popover
					aria-label="Export table"
					gutter={8}
					unmountOnHide
					portal
					wrapperProps={{ className: popoverMobileWrapperClassName }}
					className={`${menuSurfaceStyles} z-50`}
				>
					<Ariakit.PopoverDismiss aria-label="Close export options" className={popoverMobileDismissStyles}>
						<Icon name="x" className="size-5" />
					</Ariakit.PopoverDismiss>
					{csvSlot ? <div className="contents">{csvSlot}</div> : null}
					<button
						type="button"
						className={popoverMenuItemStyles}
						disabled={disabled || isLoading}
						data-umami-event="export-table-png"
						onClick={() => {
							void run('download')
							popover.hide()
						}}
					>
						<Icon name="download-paper" height={14} width={14} />
						<span>Download image</span>
					</button>
					<button
						type="button"
						className={popoverMenuItemStyles}
						disabled={disabled || isLoading}
						data-umami-event="copy-table-png"
						onClick={() => {
							void run('copy')
							popover.hide()
						}}
					>
						<Icon name="copy" height={14} width={14} />
						<span>Copy image</span>
					</button>
					{watermarkMode === 'preference' && !hideWatermarkItem ? (
						<button
							type="button"
							className={`${popoverMenuItemStyles} border-t border-medium`}
							aria-pressed={watermarkEnabled}
							onClick={toggleWatermark}
						>
							<Icon
								name={watermarkEnabled ? 'checkmark' : 'box'}
								height={14}
								width={14}
								className={watermarkEnabled ? '' : 'opacity-40'}
							/>
							<span>Include watermark</span>
						</button>
					) : null}
				</Ariakit.Popover>
			</Ariakit.PopoverProvider>
		</div>
	)
}
