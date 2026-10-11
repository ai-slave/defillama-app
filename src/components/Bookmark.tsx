import { useRouter } from 'next/router'
import toast from 'react-hot-toast'
import { useBookmarks } from '~/hooks/useBookmarks'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { trackYieldsEvent, YIELDS_EVENTS } from '~/utils/analytics/yields'
import { BasicLink } from './Link'

type WatchlistType = 'defi' | 'yields' | 'chains' | 'tokens'

const WATCHLIST_PATHS: Record<WatchlistType, string> = {
	defi: '/watchlist',
	chains: '/watchlist',
	yields: '/yields/watchlist',
	tokens: '/watchlist?tab=tokens'
}

interface IBookmarkProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	size: 'sm' | 'md'
	readableName: string
	configID?: string
	isChain?: boolean
	watchlistType?: WatchlistType
	itemKey?: string
}

export function Bookmark({
	size,
	readableName,
	configID,
	isChain,
	watchlistType: watchlistTypeProp,
	itemKey,
	className,
	onClick: onButtonClick,
	...props
}: IBookmarkProps) {
	const router = useRouter()

	const isYieldsPage = router.pathname.includes('/yields')

	const watchlistType: WatchlistType = watchlistTypeProp ?? (isChain ? 'chains' : isYieldsPage ? 'yields' : 'defi')
	const urlPath = WATCHLIST_PATHS[watchlistType]
	const watchlistNameKey = itemKey ?? (watchlistType === 'yields' ? (configID ?? readableName) : readableName)

	const { savedProtocols, addProtocol, removeProtocol } = useBookmarks(watchlistType)

	const isSaved: boolean = savedProtocols.has(watchlistNameKey)
	const label = isSaved ? 'Remove from watchlist' : 'Add to watchlist'

	const showToast = (action: 'Added' | 'Removed') => {
		toast.success(
			<span>
				{action} {readableName} {action === 'Added' ? 'to' : 'from'}{' '}
				<BasicLink href={urlPath} className="font-medium underline">
					watchlist
				</BasicLink>
			</span>
		)
	}

	const onClick = isSaved
		? () => {
				removeProtocol(watchlistNameKey)
				trackUmamiEvent('watchlist-remove', { type: watchlistType, entity: readableName })
				showToast('Removed')
			}
		: () => {
				addProtocol(watchlistNameKey)
				trackUmamiEvent('watchlist-add', { type: watchlistType, entity: readableName })
				showToast('Added')
				if (isYieldsPage) {
					trackYieldsEvent(YIELDS_EVENTS.WATCHLIST_POOL_ADD, { pool: readableName })
				}
			}

	const buttonStyle: React.CSSProperties & Record<'--fill-icon', string> = {
		'--fill-icon': isSaved ? 'var(--text-primary)' : 'none'
	}

	return (
		<Tooltip
			content={label}
			className={className}
			render={
				<Button
					size={size}
					variant="ghost"
					square
					type="button"
					{...props}
					style={buttonStyle}
					onClick={(event) => {
						onButtonClick?.(event)
						if (!event.defaultPrevented) onClick()
					}}
				/>
			}
		>
			<Icon name="bookmark" className="size-4 shrink-0" />
			<span className="sr-only">{label}</span>
		</Tooltip>
	)
}
