import { Icon } from '~/components/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { useDashboardEngagement } from '../hooks/useDashboardEngagement'

export function CardLikeButton({
	dashboardId,
	liked,
	likeCount
}: {
	dashboardId: string
	liked?: boolean
	likeCount?: number
}) {
	const { toggleLike, isLiking, liked: mutatedLiked, likeCount: mutatedLikeCount } = useDashboardEngagement(dashboardId)
	const isLiked = mutatedLiked ?? !!liked
	const count = mutatedLikeCount ?? likeCount ?? 0

	return (
		<button
			type="button"
			aria-label={isLiked ? 'Unlike dashboard' : 'Like dashboard'}
			disabled={isLiking}
			onClick={(e) => {
				e.preventDefault()
				e.stopPropagation()
				toggleLike()
			}}
			className="z-10 flex items-center gap-1.5 rounded-md bg-brand/15 px-2 py-1 text-xs font-medium text-link tabular-nums transition-colors hover:bg-brand/30"
			title={isLiked ? 'Unlike dashboard' : 'Like dashboard'}
		>
			{isLiking ? (
				<LoadingSpinner size={12} />
			) : (
				<Icon name="star" height={12} width={12} className={isLiked ? 'fill-current text-warning' : 'fill-none'} />
			)}
			{count}
		</button>
	)
}
