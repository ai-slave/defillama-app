export function SubscriptionLoadError({
	isRetrying,
	onRetry,
	message = "Couldn't load your subscription. Please try again."
}: {
	isRetrying: boolean
	onRetry: () => void
	message?: string
}) {
	return (
		<div
			role="alert"
			className="flex flex-wrap items-center gap-3 rounded-lg border border-sub-border-strong p-4 text-sm text-sub-text-primary"
		>
			<p>{message}</p>
			<button type="button" onClick={onRetry} disabled={isRetrying} className="underline disabled:opacity-50">
				{isRetrying ? 'Retrying…' : 'Try again'}
			</button>
		</div>
	)
}
