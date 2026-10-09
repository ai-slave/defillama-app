import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { Tooltip } from '~/ui/Tooltip'
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
		<Tooltip
			content={isLiked ? 'Unstar dashboard' : 'Star dashboard'}
			render={
				<Button
					type="button"
					size="sm"
					variant="ghost"
					aria-label="Star dashboard"
					aria-pressed={isLiked}
					// A compact counter has no room for a busy label: the spinner takes the star's place and the count stays.
					aria-busy={isLiking || undefined}
					onClick={(event: React.MouseEvent) => {
						event.preventDefault()
						event.stopPropagation()
						if (!isLiking) toggleLike()
					}}
					className="z-10"
				/>
			}
		>
			{isLiking ? (
				<LoadingSpinner size={14} />
			) : (
				<Icon name="star" height={14} width={14} className={isLiked ? 'fill-current text-warning' : 'fill-none'} />
			)}
			<span className="tabular-nums">{count}</span>
		</Tooltip>
	)
}
