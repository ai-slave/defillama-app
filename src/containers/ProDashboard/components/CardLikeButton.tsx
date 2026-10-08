import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
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
					pendingLabel={isLiking ? 'Saving…' : null}
					onClick={(event: React.MouseEvent) => {
						event.preventDefault()
						event.stopPropagation()
						toggleLike()
					}}
					className="z-10"
				/>
			}
		>
			<Icon name="star" height={14} width={14} className={isLiked ? 'fill-current text-warning' : 'fill-none'} />
			<span className="tabular-nums">{count}</span>
		</Tooltip>
	)
}
