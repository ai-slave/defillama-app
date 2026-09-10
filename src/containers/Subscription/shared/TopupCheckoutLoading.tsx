import { LoadingSpinner } from '~/ui/Loaders'

export function TopupCheckoutLoading() {
	return (
		<div role="status" className="flex min-h-[400px] items-center justify-center gap-2 body-md text-secondary">
			<LoadingSpinner size={16} />
			<span>Loading card payments…</span>
		</div>
	)
}
