import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import type { KeyboardEvent, ReactNode } from 'react'
import toast from 'react-hot-toast'
import { type ChartPngExportOptions, useChartPngExport } from '~/components/ChartExport/useChartPngExport'
import {
	CSV_DOWNLOAD_ERROR,
	CsvDownloadDialogs,
	downloadPreparedCsv,
	type PrepareCsv,
	useCsvDownload
} from '~/components/CsvDownloadButton'
import { useIsClient } from '~/hooks/useIsClient'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import {
	menuSurfaceStyles,
	popoverMenuItemStyles,
	popoverMobileDismissStyles,
	popoverMobileWrapperClassName
} from '~/ui/Popover'
import { Tooltip } from '~/ui/Tooltip'
import { useProDashboardPermissions } from '../ProDashboardAPIContext'
import type { UnifiedRowHeaderType } from '../unifiedTable/config/types'
import { type CsvExportLevel, EXPORT_LEVEL_LABELS } from './UnifiedTable/core/csvExportLevels'

const noChart = () => null
export function keepKeyboardEventsInsideCard(event: KeyboardEvent) {
	event.stopPropagation()
}
export function ProCardEditControls({ children }: { children: ReactNode }) {
	const { isReadOnly } = useProDashboardPermissions()
	if (isReadOnly) return null
	return (
		<div
			role="presentation"
			onKeyDown={keepKeyboardEventsInsideCard}
			className="flex flex-wrap items-center gap-2 opacity-0 transition-opacity group-focus-within/dashboard-card:opacity-100 group-hover/dashboard-card:opacity-100 has-[[aria-expanded=true]]:opacity-100 motion-reduce:transition-none pointer-coarse:opacity-100"
		>
			{children}
		</div>
	)
}
interface ProCardOverflowMenuProps {
	image?: ChartPngExportOptions | undefined
	csv?:
		| { prepareCsv: PrepareCsv; onClick?: never; isLoading?: never; disabled?: boolean }
		| { onClick: () => void | Promise<void>; isLoading?: boolean | undefined; prepareCsv?: never; disabled?: boolean }
		| undefined
	csvLevels?:
		| {
				rowHeaders: Array<UnifiedRowHeaderType>
				onExport: (level: CsvExportLevel) => void | Promise<void>
				isLoading?: boolean | undefined
		  }
		| undefined
	onDuplicate?: (() => void) | undefined
	disabled?: boolean | undefined
}
export function ProCardOverflowMenu({ image, csv, csvLevels, onDuplicate, disabled }: ProCardOverflowMenuProps) {
	const { isReadOnly, hideDuplicateButton } = useProDashboardPermissions()
	const router = useRouter()
	const { isExporting, downloadImage, copyImage } = useChartPngExport(image ?? { chartInstance: noChart })
	const csvDownload = useCsvDownload()
	const isClient = useIsClient()
	const menu = Ariakit.useMenuStore({
		placement: 'bottom-end',
		setOpen: (open) => {
			if (open) csvDownload.clearError()
		}
	})
	const canDuplicate = !!onDuplicate && !isReadOnly && !hideDuplicateButton
	if (!image && !csv && !csvLevels && !canDuplicate) return null
	const busy = !!disabled || isExporting
	const csvBusy =
		busy ||
		!isClient ||
		csvDownload.userLoading ||
		csvDownload.status === 'pending' ||
		!!csv?.isLoading ||
		!!csvLevels?.isLoading ||
		!!csv?.disabled
	const requestDownload = (run: () => void | Promise<void>) =>
		csvDownload.requestDownload(
			async () => {
				await run()
				menu.hide()
			},
			() => {
				const { open, contentElement } = menu.getState()
				if (!open || !contentElement?.isConnected) toast.error(CSV_DOWNLOAD_ERROR)
			}
		)
	const exportCsv = () => {
		if (csv) void requestDownload(() => (csv.prepareCsv ? downloadPreparedCsv(csv.prepareCsv) : csv.onClick()))
	}
	const exportLevels: Array<CsvExportLevel> = csvLevels
		? ['all', ...csvLevels.rowHeaders.filter((header) => header !== 'protocol')]
		: []
	return (
		<div role="presentation" onKeyDown={keepKeyboardEventsInsideCard}>
			<Ariakit.MenuProvider store={menu}>
				<Tooltip
					content="More actions"
					render={
						<Ariakit.MenuButton
							render={<Button size="sm" square variant="ghost" />}
							disabled={(disabled && !canDuplicate) || !isClient}
							accessibleWhenDisabled
							aria-label="More actions"
						/>
					}
				>
					<Icon name="ellipsis" height={16} width={16} />
				</Tooltip>
				<Ariakit.Menu
					portal
					composite={false}
					unmountOnHide
					gutter={8}
					className={menuSurfaceStyles}
					wrapperProps={{ className: popoverMobileWrapperClassName }}
				>
					<Ariakit.PopoverDismiss aria-label="Close menu" className={popoverMobileDismissStyles}>
						<Icon name="x" className="size-5" />
					</Ariakit.PopoverDismiss>
					<Ariakit.MenuList store={menu} aria-label="Card actions">
						{image ? (
							<>
								<Ariakit.MenuItem
									className={popoverMenuItemStyles}
									disabled={busy}
									onClick={downloadImage}
									data-umami-event="export-image"
									data-umami-event-page={router.pathname}
								>
									Download image
								</Ariakit.MenuItem>
								<Ariakit.MenuItem
									className={popoverMenuItemStyles}
									disabled={busy}
									onClick={copyImage}
									data-umami-event="copy-image"
									data-umami-event-page={router.pathname}
								>
									Copy image
								</Ariakit.MenuItem>
							</>
						) : null}
						{csv ? (
							<Ariakit.MenuItem
								className={popoverMenuItemStyles}
								disabled={csvBusy}
								accessibleWhenDisabled
								hideOnClick={false}
								onClick={exportCsv}
								data-umami-event="export-csv"
								data-umami-event-page={router.pathname}
							>
								Download CSV
							</Ariakit.MenuItem>
						) : null}
						{exportLevels.map((level) => (
							<Ariakit.MenuItem
								key={level}
								className={popoverMenuItemStyles}
								disabled={csvBusy}
								accessibleWhenDisabled
								hideOnClick={false}
								onClick={() => {
									void requestDownload(() => csvLevels?.onExport(level))
								}}
								data-umami-event="export-csv"
								data-umami-event-page={router.pathname}
							>
								Download CSV: {EXPORT_LEVEL_LABELS[level]}
							</Ariakit.MenuItem>
						))}
						{canDuplicate ? (
							<>
								{image || csv || csvLevels ? <Ariakit.MenuSeparator /> : null}
								<Ariakit.MenuItem className={popoverMenuItemStyles} onClick={onDuplicate}>
									Duplicate
								</Ariakit.MenuItem>
							</>
						) : null}
					</Ariakit.MenuList>
					{csvDownload.status === 'error' ? (
						<p role="alert" className="max-w-xs px-3 py-2 text-xs text-error">
							{CSV_DOWNLOAD_ERROR}
						</p>
					) : null}
				</Ariakit.Menu>
			</Ariakit.MenuProvider>
			<span role="status" className="sr-only">
				{csvDownload.status === 'pending' ? 'Preparing CSV download' : ''}
			</span>
			<CsvDownloadDialogs controller={csvDownload} />
		</div>
	)
}
