import { Icon } from '~/ui/Icon'

export interface UploadSelectionFeedback {
	added: number
	skipped: Array<{ filename: string; reason: string }>
}

export function formatUploadSelectionSummary({ added, skipped }: UploadSelectionFeedback) {
	return `${added} ${added === 1 ? 'file' : 'files'} added${skipped.length > 0 ? ` · ${skipped.length} skipped` : ''}`
}

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
		<div className="relative px-1 py-1 pr-8 text-xs leading-5 text-secondary">
			{feedback.skipped.length > 0 ? (
				<details>
					<summary className="flex cursor-pointer flex-wrap items-center gap-x-2 rounded-sm focus-visible:focus-ring">
						<span role="status">{label}</span>
						<span className="text-brand">View skipped files</span>
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
				<p role="status">{label}</p>
			)}
			<button
				type="button"
				aria-label="Dismiss file selection details"
				onClick={onDismiss}
				className="absolute top-0 right-0 flex size-6 items-center justify-center rounded-md hover:bg-hover-row focus-visible:focus-ring"
			>
				<Icon name="x" height={14} width={14} />
			</button>
		</div>
	)
}
