import { Button } from '~/ui/Button'

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
		<div role="alert" className="flex flex-wrap items-center gap-2 body-sm text-error">
			<p>{message}</p>
			<Button type="button" size="sm" onClick={onRetry} pendingLabel={retrying ? 'Retrying…' : null}>
				Try again
			</Button>
		</div>
	)
}
