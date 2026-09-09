import { LoadingSpinner } from '~/ui/Loaders'

export function DashboardCardLoader({ className }: { className: string }) {
	return (
		<div
			role="status"
			className={`flex items-center justify-center gap-2 p-4 text-sm text-pro-text-tertiary ${className}`}
		>
			<LoadingSpinner size={16} />
			Loading dashboard card…
		</div>
	)
}
