import { Button } from '~/ui/Button'
import { focusRegionOnLeave } from '~/ui/focus'
import { InlineStatus } from '~/ui/Status'

/** A failed read in a LlamaAI panel, menu or form, with its Try again. A retry that succeeds removes the notice with
    focus inside it, so the region around it takes that focus. */
export function RetryNotice({
	message,
	retrying,
	onRetry
}: {
	message: string
	retrying: boolean
	onRetry: () => void
}) {
	return (
		<div ref={focusRegionOnLeave} className="w-full min-w-0">
			<InlineStatus
				variant="error"
				action={
					<Button type="button" size="sm" onClick={onRetry} pendingLabel="Retrying…" pending={retrying}>
						Try again
					</Button>
				}
			>
				{message}
			</InlineStatus>
		</div>
	)
}
