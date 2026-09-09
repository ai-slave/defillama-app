import * as Ariakit from '@ariakit/react'
import toast from 'react-hot-toast'
import { CSV_DOWNLOAD_ERROR, CsvDownloadDialogs, useCsvDownload } from '~/components/CsvDownloadButton'
import { useIsClient } from '~/hooks/useIsClient'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import type { UnifiedRowHeaderType } from '../../../unifiedTable/config/types'

export type CsvExportLevel = 'all' | UnifiedRowHeaderType

const EXPORT_LEVEL_LABELS: Record<CsvExportLevel, string> = {
	all: 'All Protocols',
	chain: 'Chains Only',
	category: 'Categories Only',
	'parent-protocol': 'Protocol Groups Only',
	protocol: 'Protocols Only'
}

interface CsvExportDropdownProps {
	rowHeaders: Array<UnifiedRowHeaderType>
	onExport: (level: CsvExportLevel) => void | Promise<void>
	isLoading: boolean
	disabled: boolean
}

export function CsvExportDropdown({ rowHeaders, onExport, isLoading, disabled }: CsvExportDropdownProps) {
	const csv = useCsvDownload()
	const menu = Ariakit.useMenuStore({
		placement: 'bottom-end',
		setOpen: (open) => {
			if (open) csv.clearError()
		}
	})
	const isClient = useIsClient()
	const unavailable = disabled || isLoading || csv.userLoading || csv.status === 'pending' || !isClient
	const exportOptions: Array<CsvExportLevel> = ['all', ...rowHeaders.filter((header) => header !== 'protocol')]

	return (
		<div>
			<Ariakit.MenuButton
				store={menu}
				disabled={unavailable}
				accessibleWhenDisabled
				className="flex items-center gap-2 rounded-md border pro-border pro-hover-bg pro-panel-bg px-3 py-1.5 text-sm text-pro-text-primary transition-colors aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
			>
				{isLoading || csv.userLoading || csv.status === 'pending' ? (
					<LoadingSpinner size={14} />
				) : (
					<Icon name="download-paper" className="size-3.5 shrink-0" />
				)}
				{csv.status === 'pending' ? 'Preparing…' : 'Download .csv'}
			</Ariakit.MenuButton>
			<Ariakit.Menu
				store={menu}
				portal
				composite={false}
				aria-label="CSV export"
				gutter={4}
				className="z-50 max-w-[calc(100vw-1rem)] rounded-md border border-pro-cards-border bg-pro-cards-bg p-1 shadow-lg"
			>
				<Ariakit.MenuList store={menu} aria-label="CSV export options">
					{exportOptions.map((level) => (
						<Ariakit.MenuItem
							key={level}
							disabled={unavailable}
							accessibleWhenDisabled
							hideOnClick={false}
							onClick={() => {
								csv.requestDownload(
									async () => {
										await onExport(level)
										menu.hide()
									},
									() => {
										// A dismissed popup cannot report the failure inline.
										const { open, contentElement } = menu.getState()
										if (!open || !contentElement?.isConnected) toast.error(CSV_DOWNLOAD_ERROR)
									}
								)
							}}
							className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm text-pro-text-primary aria-disabled:opacity-50 data-active-item:bg-border-subtle"
						>
							<Icon name="download-paper" className="size-3 shrink-0 text-pro-text-tertiary" />
							{EXPORT_LEVEL_LABELS[level]}
						</Ariakit.MenuItem>
					))}
				</Ariakit.MenuList>
				{csv.status === 'error' ? (
					<p role="alert" className="max-w-xs px-3 py-2 text-xs text-error">
						{CSV_DOWNLOAD_ERROR}
					</p>
				) : null}
			</Ariakit.Menu>
			<span role="status" className="sr-only">
				{csv.status === 'pending' ? 'Preparing CSV download' : ''}
			</span>
			<CsvDownloadDialogs controller={csv} />
		</div>
	)
}
