import { Card } from '~/ui/Card'
import { tw } from '~/ui/tw'
import { SkeletonShimmer } from './ProCardSkeleton'

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
				// oxlint-disable-next-line react/no-array-index-key -- Loading placeholders are fixed display slots, not data items.
				<SkeletonCard key={`skeleton-item-${i}`} viewMode={viewMode} />
			))}
		</div>
	)
}

const GRID_CARD_CLASS = tw`relative isolate min-h-[220px] overflow-hidden`
const LIST_CARD_CLASS = tw`relative isolate min-h-[156px] overflow-hidden`

function SkeletonCard({ viewMode }: { viewMode: 'grid' | 'list' }) {
	return (
		<Card padding="none" className={viewMode === 'grid' ? GRID_CARD_CLASS : LIST_CARD_CLASS} aria-hidden>
			<SkeletonShimmer />
		</Card>
	)
}
