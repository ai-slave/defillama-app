import { LoadingIndicator } from '~/ui/Status'

export function TopupCheckoutLoading() {
	return (
		<div role="status" aria-live="polite" className="flex min-h-[400px] items-center justify-center">
			<LoadingIndicator label="Loading card payments" />
		</div>
	)
}
