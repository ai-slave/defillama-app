import { useRouter } from 'next/router'
import { BasicLink } from '~/components/Link'
import { TabLink, tabTrackStyles } from '~/ui/Tab'

export function WatchListTabs() {
	const router = useRouter()
	const isTokensTab = router.pathname === '/watchlist' && router.query.tab === 'tokens'
	return (
		<nav className={`${tabTrackStyles} max-w-fit`}>
			<TabLink as={BasicLink} href="/watchlist" data-active={router.pathname === '/watchlist' && !isTokensTab}>
				DeFi
			</TabLink>

			<TabLink as={BasicLink} href="/yields/watchlist" data-active={router.pathname === '/yields/watchlist'}>
				Yields
			</TabLink>

			<TabLink as={BasicLink} href="/watchlist?tab=tokens" data-active={isTokensTab}>
				Tokens
			</TabLink>
		</nav>
	)
}
