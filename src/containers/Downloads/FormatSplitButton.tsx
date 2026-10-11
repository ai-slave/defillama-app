import * as Ariakit from '@ariakit/react'
import { Button, ButtonGroup } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { MenuItem, MenuSurface } from '~/ui/PopoverSurface'
import type { DownloadFormat } from '~/utils/download'
import { ConfirmableContent } from './ActionFeedback'

interface FormatSplitButtonProps {
	onDownload: (format: DownloadFormat) => void
	disabled: boolean
	label: string
	/** The last download just finished: the button says so in place of a toast. */
	confirmed?: boolean
}

const DOWNLOAD_FORMATS = ['csv', 'json'] as const

const FORMAT_LABELS: Record<DownloadFormat, string> = {
	csv: 'CSV',
	json: 'JSON'
}

export function FormatSplitButton({ onDownload, disabled, label, confirmed = false }: FormatSplitButtonProps) {
	const menu = Ariakit.useMenuStore<{ format: DownloadFormat }>({ defaultValues: { format: 'csv' } })
	const { format } = Ariakit.useStoreState(menu, 'values')

	return (
		<ButtonGroup label={label}>
			<Button
				variant="primary"
				size="md"
				aria-label={`${label} ${FORMAT_LABELS[format]}`}
				onClick={() => onDownload(format)}
				disabled={disabled}
			>
				<ConfirmableContent
					confirmed={confirmed}
					idle={
						<>
							<Icon name="download-cloud" className="size-3.5" />
							<span className="hidden sm:inline">
								{label} {FORMAT_LABELS[format]}
							</span>
						</>
					}
					done={
						<>
							<Icon name="check" className="size-3.5" />
							<span className="hidden sm:inline">Downloaded</span>
						</>
					}
				/>
			</Button>
			<Ariakit.MenuProvider store={menu}>
				<Ariakit.MenuButton
					disabled={disabled}
					aria-label="Choose download format"
					render={<Button variant="primary" size="md" square />}
				>
					<Icon name="chevron-down" className="size-3.5" />
				</Ariakit.MenuButton>
				<MenuSurface variant="actions">
					{DOWNLOAD_FORMATS.map((fmt) => (
						<MenuItem kind="radio" key={fmt} name="format" value={fmt} hideOnClick onClick={() => onDownload(fmt)}>
							{FORMAT_LABELS[fmt]}
						</MenuItem>
					))}
				</MenuSurface>
			</Ariakit.MenuProvider>
		</ButtonGroup>
	)
}
