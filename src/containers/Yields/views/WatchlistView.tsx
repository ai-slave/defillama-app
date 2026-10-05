import { useRouter } from 'next/router'
import { BasicLink } from '~/components/Link'
import { TabLink, tabTrackStyles } from '~/ui/Tab'

export function WatchListTabs() {
	const router = useRouter()
	const isTokensTab = router.pathname === '/watchlist' && router.query.tab === 'tokens'
	return (
		<nav className={`${tabTrackStyles} max-w-fit`} aria-label="Watchlist">
			<TabLink
				as={BasicLink}
				href="/watchlist"
				aria-current={router.pathname === '/watchlist' && !isTokensTab ? 'page' : undefined}
			>
				DeFi
			</TabLink>

			<TabLink
				as={BasicLink}
				href="/yields/watchlist"
				aria-current={router.pathname === '/yields/watchlist' ? 'page' : undefined}
			>
				Yields
			</TabLink>

			<TabLink as={BasicLink} href="/watchlist?tab=tokens" aria-current={isTokensTab ? 'page' : undefined}>
				Tokens
			</TabLink>
		</nav>
	)
}
