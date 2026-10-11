import { useAuthContext } from '~/auth'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import type { Dashboard } from '../dashboardTypes'
import { useDashboardEngagement } from '../hooks/useDashboardEngagement'

export function LikeDashboardButton({
	currentDashboard,
	dashboardVisibility,
	dashboardId
}: {
	currentDashboard: Dashboard
	dashboardVisibility: 'private' | 'public'
	dashboardId: string
}) {
	const { isAuthenticated } = useAuthContext()
	const { toggleLike, isLiking, liked, likeCount } = useDashboardEngagement(dashboardId)
	if (dashboardVisibility === 'private') return null
	const isLiked = liked ?? !!currentDashboard.liked
	return (
		<Tooltip
			content="Star dashboard"
			render={
				<Button
					size="md"
					aria-label="Star dashboard"
					aria-pressed={isLiked}
					type="button"
					variant="ghost"
					onClick={() => toggleLike()}
					disabled={!isAuthenticated}
					pendingLabel="Saving…"
					pending={isLiking}
				/>
			}
		>
			<Icon name="star" className={isLiked ? 'size-3.5 fill-current text-warning' : 'size-3.5 fill-none'} />
			<span>{likeCount ?? currentDashboard.likeCount ?? 0}</span>
			<span className="sr-only">Stars</span>
		</Tooltip>
	)
}
