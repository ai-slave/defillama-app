import { Button } from '~/ui/Button'
import { focusRegionOnLeave } from '~/ui/focus'
import { InlineStatus } from '~/ui/Status'

export function SubscriptionLoadError({
	isRetrying,
	onRetry,
	message = "Couldn't load your subscription."
}: {
	isRetrying: boolean
	onRetry: () => void
	message?: string
}) {
	return (
		<InlineStatus
			variant="error"
			action={
				// A retry that succeeds removes this notice and its button, so focus moves to the region around it.
				<Button
					ref={focusRegionOnLeave}
					type="button"
					size="sm"
					onClick={onRetry}
					pendingLabel={isRetrying ? 'Retrying…' : null}
				>
					Try again
				</Button>
			}
		>
			{message}
		</InlineStatus>
	)
}
