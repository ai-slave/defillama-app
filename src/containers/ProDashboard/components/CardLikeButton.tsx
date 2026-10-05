import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { useDashboardEngagement } from '../hooks/useDashboardEngagement'
import { ProButton } from '../ui'

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
		<ProButton
			type="button"
			size="sm"
			variant="ghost"
			aria-label="Star dashboard"
			aria-pressed={isLiked}
			disabled={isLiking}
			onClick={(event: React.MouseEvent) => {
				event.preventDefault()
				event.stopPropagation()
				toggleLike()
			}}
			className="z-10 tabular-nums"
			title={isLiked ? 'Unstar dashboard' : 'Star dashboard'}
		>
			{isLiking ? (
				<LoadingSpinner size={14} />
			) : (
				<Icon name="star" height={14} width={14} className={isLiked ? 'fill-current text-warning' : 'fill-none'} />
			)}
			{count}
		</ProButton>
	)
}
