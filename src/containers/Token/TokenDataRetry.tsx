import { Button } from '~/ui/Button'

export function TokenDataRetry({
	message,
	isRetrying,
	onRetry
}: {
	message: string
	isRetrying: boolean
	onRetry: () => void
}) {
	return (
		<div className="flex flex-wrap items-center justify-center gap-2">
			<span>{message}</span>
			<Button size="sm" pendingLabel={isRetrying ? 'Retrying…' : null} onClick={onRetry}>
				Retry
			</Button>
		</div>
	)
}
