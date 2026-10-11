import { Skeleton } from '~/ui/Skeleton'

interface LoadingSkeletonProps {
	viewMode?: 'grid' | 'list'
	items?: number
}

export function LoadingSkeleton({ viewMode = 'grid', items = 18 }: LoadingSkeletonProps) {
	return (
		<div
			className={
				viewMode === 'grid' ? 'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4' : 'space-y-3'
			}
			role="status"
			aria-live="polite"
			aria-busy="true"
		>
			{/* The cards are aria-hidden shapes, so the region needs words to announce. */}
			<span className="sr-only">Loading dashboards</span>
			{Array.from({ length: items }).map((_, i) => (
				<Skeleton
					// oxlint-disable-next-line react/no-array-index-key -- Loading placeholders are fixed display slots, not data items.
					key={`skeleton-item-${i}`}
					className={viewMode === 'grid' ? 'min-h-[220px] rounded-lg' : 'min-h-[156px] rounded-lg'}
				/>
			))}
		</div>
	)
}
