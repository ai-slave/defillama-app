import * as Ariakit from '@ariakit/react'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { MenuItem, MenuSurface } from '~/ui/MenuSurface'
import { Tooltip } from '~/ui/Tooltip'
import type { DownloadFormat } from '~/utils/download'
import { ConfirmableContent } from './ActionFeedback'
import { FormatSplitButton } from './FormatSplitButton'

/* The header actions of the Downloads preview workspaces. From sm, Copy, Save preset and Copy link sit beside
   Download, icon-only below lg. On a phone Download stays and the others fold into More actions; their outcome is
   announced by the modal's ActionFeedbackStatus, since the menu closes on the press. A preview keeps Copy and
   Download, and both open the subscribe prompt. */

type Action = { run: () => void; disabled: boolean }

type PreviewHeaderActionsProps = {
	confirmed: (action: string) => boolean
	downloadLabel: string
	/** Null where the modal has nothing to copy, such as a combined preview. */
	copy: Action | null
} & (
	| { mode: 'preview'; onSubscribe: () => void }
	| {
			mode: 'full'
			savePreset: Action
			copyLink: Action
			onDownload: (format: DownloadFormat) => void
			downloadDisabled: boolean
	  }
)

export function PreviewHeaderActions(props: PreviewHeaderActionsProps) {
	const { confirmed, downloadLabel, copy } = props
	const savePreset = props.mode === 'full' ? props.savePreset : null
	const copyLink = props.mode === 'full' ? props.copyLink : null
	return (
		<>
			{copy ? (
				<Tooltip
					content="Copy selected columns as TSV"
					render={<Button size="md" disabled={copy.disabled} onClick={copy.run} className="max-sm:hidden" />}
				>
					<ConfirmableContent
						confirmed={confirmed('copy')}
						idle={
							<>
								<Icon name="clipboard" className="size-3.5" aria-hidden="true" />
								<span className="max-lg:sr-only">Copy</span>
							</>
						}
						done={
							<>
								<Icon name="check" className="size-3.5" aria-hidden="true" />
								<span className="max-lg:sr-only">Copied</span>
							</>
						}
					/>
				</Tooltip>
			) : null}
			{savePreset ? (
				<Tooltip
					content="Save as preset"
					render={
						<Button size="md" disabled={savePreset.disabled} onClick={savePreset.run} className="max-sm:hidden" />
					}
				>
					<ConfirmableContent
						confirmed={confirmed('save-preset')}
						idle={
							<>
								<Icon name="bookmark" className="size-3.5" aria-hidden="true" />
								<span className="max-lg:sr-only">Save preset</span>
							</>
						}
						done={
							<>
								<Icon name="check" className="size-3.5" aria-hidden="true" />
								<span className="max-lg:sr-only">Saved</span>
							</>
						}
					/>
				</Tooltip>
			) : null}
			{copyLink ? (
				<Tooltip
					content="Copy shareable link"
					render={
						<Button
							size="md"
							square
							aria-label="Copy shareable link"
							disabled={copyLink.disabled}
							onClick={copyLink.run}
							className="max-sm:hidden"
						/>
					}
				>
					<ConfirmableContent
						confirmed={confirmed('copy-link')}
						idle={<Icon name="link" className="size-4" aria-hidden="true" />}
						done={<Icon name="check" className="size-4" aria-hidden="true" />}
					/>
				</Tooltip>
			) : null}
			{copy || savePreset || copyLink ? (
				<Ariakit.MenuProvider>
					<Ariakit.MenuButton
						render={<Button variant="ghost" size="md" square aria-label="More actions" className="sm:hidden" />}
					>
						<Icon name="ellipsis" className="size-4" aria-hidden="true" />
					</Ariakit.MenuButton>
					<MenuSurface variant="actions" className="z-50">
						{copy ? (
							<MenuItem disabled={copy.disabled} onClick={copy.run}>
								<Icon name="clipboard" className="size-3.5" aria-hidden="true" />
								Copy
							</MenuItem>
						) : null}
						{savePreset ? (
							<MenuItem disabled={savePreset.disabled} onClick={savePreset.run}>
								<Icon name="bookmark" className="size-3.5" aria-hidden="true" />
								Save preset
							</MenuItem>
						) : null}
						{copyLink ? (
							<MenuItem disabled={copyLink.disabled} onClick={copyLink.run}>
								<Icon name="link" className="size-3.5" aria-hidden="true" />
								Copy link
							</MenuItem>
						) : null}
					</MenuSurface>
				</Ariakit.MenuProvider>
			) : null}
			{props.mode === 'preview' ? (
				<Button variant="primary" size="md" onClick={props.onSubscribe}>
					<Icon name="download-cloud" className="size-3.5" aria-hidden="true" />
					<span className="max-sm:sr-only">{downloadLabel}</span>
				</Button>
			) : (
				<FormatSplitButton
					onDownload={props.onDownload}
					disabled={props.downloadDisabled}
					label={downloadLabel}
					confirmed={confirmed('download')}
				/>
			)}
		</>
	)
}
