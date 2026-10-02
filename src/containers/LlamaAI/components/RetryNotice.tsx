import { Button } from '~/ui/Button'
import { passFocusOnLeave } from '~/ui/focus'

// A retry that succeeds removes the notice with its focused button. Content that loads in its place can take focus
// (takeLostFocus); otherwise the closest focusable region around the notice does, such as its list or section. Inside a
// dialog the dialog's own net (catchLostFocus) catches it instead.
const focusRegionOnLeave = passFocusOnLeave((notice) =>
	notice.closest('[data-dialog]') ? null : notice.parentElement?.closest<HTMLElement>('[tabindex]')
)

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
		<div ref={focusRegionOnLeave} role="alert" className="flex flex-wrap items-center gap-2 body-sm text-error">
			<p>{message}</p>
			<Button type="button" size="sm" onClick={onRetry} pendingLabel={retrying ? 'Retrying…' : null}>
				Try again
			</Button>
		</div>
	)
}
