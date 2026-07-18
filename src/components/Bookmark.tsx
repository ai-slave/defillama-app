import { useRouter } from 'next/router'
import toast from 'react-hot-toast'
import { useBookmarks } from '~/hooks/useBookmarks'
import { Icon } from '~/ui/Icon'
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
	readableName: string
	configID?: string
	isChain?: boolean
	watchlistType?: WatchlistType
	itemKey?: string
}

export function Bookmark({
	readableName,
	configID,
	isChain,
	watchlistType: watchlistTypeProp,
	itemKey,
	className,
	...props
}: IBookmarkProps) {
	const router = useRouter()

	const isYieldsPage = router.pathname.includes('/yields')

	const watchlistType: WatchlistType = watchlistTypeProp ?? (isChain ? 'chains' : isYieldsPage ? 'yields' : 'defi')
	const urlPath = WATCHLIST_PATHS[watchlistType]
	const watchlistNameKey = itemKey ?? (watchlistType === 'yields' ? (configID ?? readableName) : readableName)

	const { savedProtocols, addProtocol, removeProtocol } = useBookmarks(watchlistType)

	const isSaved: boolean = savedProtocols.has(watchlistNameKey)

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
				showToast('Removed')
			}
		: () => {
				addProtocol(watchlistNameKey)
				showToast('Added')
				if (isYieldsPage) {
					trackYieldsEvent(YIELDS_EVENTS.WATCHLIST_POOL_ADD, { pool: readableName })
				}
			}

	const buttonStyle: React.CSSProperties & Record<'--fill-icon', string> = {
		'--fill-icon': isSaved ? 'var(--text-primary)' : 'none'
	}

	return (
		<button
			onClick={onClick}
			style={buttonStyle}
			{...props}
			className={`-left-0.5 shrink-0 data-[bookmark=true]:absolute data-[lgonly=true]:hidden lg:data-[lgonly=true]:inline-block ${className ?? ''}`}
		>
			<Icon name="bookmark" width={16} height={16} className="shrink-0" />
			<span className="sr-only">Bookmark</span>
		</button>
	)
}
