import { Button } from '~/ui/Button'
import { pageContent, passFocusOnLeave } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'

export interface UploadSelectionFeedback {
	added: number
	skipped: Array<{ filename: string; reason: string }>
}

export function formatUploadSelectionSummary({ added, skipped }: UploadSelectionFeedback) {
	return `${added} ${added === 1 ? 'file' : 'files'} added${skipped.length > 0 ? ` · ${skipped.length} skipped` : ''}`
}

// Dismiss removes the notice with its own button: a composer's prompt field takes focus, else the page content.
// Inside a dialog the dialog's net (catchLostFocus) takes it instead.
const dismissFocusOnLeave = passFocusOnLeave(
	(node) => node.closest('form')?.querySelector('textarea') ?? (node.closest('[data-dialog]') ? null : pageContent())
)

export function UploadSelectionNotice({
	feedback,
	onDismiss
}: {
	feedback: UploadSelectionFeedback | null
	onDismiss: () => void
}) {
	if (!feedback) return null
	const label = formatUploadSelectionSummary(feedback)
	return (
		<div className="flex items-start gap-2 px-1 py-1 text-xs leading-5 text-secondary">
			{feedback.skipped.length > 0 ? (
				<details className="flex-1">
					<summary className="flex cursor-pointer flex-wrap items-center gap-x-2 rounded-sm">
						<span role="status">{label}</span>
						<span className="text-link">View skipped files</span>
					</summary>
					<ul className="mt-2 flex max-h-40 flex-col gap-2 overflow-auto">
						{feedback.skipped.map(({ filename, reason }) => (
							<li key={`${filename}-${reason}`} className="break-words">
								<span className="font-medium text-primary">{filename}</span> — {reason}
							</li>
						))}
					</ul>
				</details>
			) : (
				<p role="status" className="flex-1">
					{label}
				</p>
			)}
			<Tooltip
				content="Dismiss"
				render={
					<Button
						ref={dismissFocusOnLeave}
						variant="ghost"
						size="sm"
						square
						aria-label="Dismiss file selection details"
						onClick={onDismiss}
					/>
				}
			>
				<Icon name="x" className="size-4" />
			</Tooltip>
		</div>
	)
}
