import { Button } from '~/ui/Button'
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
		<InlineStatus variant="error">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<span>{message}</span>
				<Button type="button" size="sm" onClick={onRetry} pendingLabel={isRetrying ? 'Retrying…' : null}>
					Try again
				</Button>
			</div>
		</InlineStatus>
	)
}
