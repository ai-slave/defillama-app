import * as Ariakit from '@ariakit/react'
import { Icon } from '~/ui/Icon'
import type { DownloadFormat } from '~/utils/download'

interface FormatSplitButtonProps {
	onDownload: (format: DownloadFormat) => void
	disabled?: boolean
	label?: string
}

const DOWNLOAD_FORMATS = ['csv', 'json'] as const

const FORMAT_LABELS: Record<DownloadFormat, string> = {
	csv: 'CSV',
	json: 'JSON'
}

export function FormatSplitButton({ onDownload, disabled, label = 'Download' }: FormatSplitButtonProps) {
	const menu = Ariakit.useMenuStore<{ format: DownloadFormat }>({ defaultValues: { format: 'csv' } })
	const { format } = Ariakit.useStoreState(menu, 'values')

	return (
		<div className="inline-flex overflow-hidden rounded-md bg-brand shadow-sm">
			<button
				type="button"
				aria-label={`${label} ${FORMAT_LABELS[format]}`}
				onClick={() => onDownload(format)}
				disabled={disabled}
				className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-on-brand transition-colors hover:bg-black/10 disabled:opacity-40"
			>
				<Icon name="download-cloud" className="size-3.5" />
				<span className="hidden sm:inline">
					{label} {FORMAT_LABELS[format]}
				</span>
			</button>
			<Ariakit.MenuProvider store={menu}>
				<Ariakit.MenuButton
					disabled={disabled}
					aria-label="Choose download format"
					className="flex items-center border-l border-white/20 px-1.5 text-on-brand transition-colors hover:bg-black/10 disabled:opacity-40"
				>
					<Icon name="chevron-down" className="size-3.5" />
				</Ariakit.MenuButton>
				<Ariakit.Menu
					gutter={4}
					unmountOnHide
					hideOnInteractOutside
					className="z-50 min-w-32 overflow-hidden rounded-lg border border-medium bg-surface-elevated-1 shadow-lg"
				>
					{DOWNLOAD_FORMATS.map((fmt) => (
						<Ariakit.MenuItemRadio
							key={fmt}
							name="format"
							value={fmt}
							hideOnClick
							onClick={() => {
								onDownload(fmt)
							}}
							className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-xs font-medium text-pro-text-primary hover:bg-hover-row data-active-item:bg-hover-row"
						>
							<span>{FORMAT_LABELS[fmt]}</span>
							{format === fmt ? (
								<Icon name="check" className="size-3.5 text-brand" />
							) : (
								<span className="size-3.5" aria-hidden="true" />
							)}
						</Ariakit.MenuItemRadio>
					))}
				</Ariakit.Menu>
			</Ariakit.MenuProvider>
		</div>
	)
}
