import { useAuthContext } from '~/auth'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import type { Dashboard } from '../dashboardTypes'
import { useDashboardEngagement } from '../hooks/useDashboardEngagement'
import { ProButton } from '../ui'

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
				<ProButton
					aria-label="Star dashboard"
					aria-pressed={isLiked}
					type="button"
					variant="ghost"
					onClick={() => toggleLike()}
					disabled={!isAuthenticated}
					icon={
						<Icon name="star" height={14} width={14} className={isLiked ? 'fill-current text-warning' : 'fill-none'} />
					}
					{...(isLiking ? { loading: true } : {})}
				/>
			}
		>
			<span>{likeCount ?? currentDashboard.likeCount ?? 0}</span>
			<span className="sr-only">Stars</span>
		</Tooltip>
	)
}
