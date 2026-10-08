import { useRouter } from 'next/router'
import { BasicLink } from '~/components/Link'
import { TabLink, tabTrackStyles } from '~/ui/Tab'
import type { RWAPageKind } from './pageLayout'
import { getRwaPageTabRow } from './pageTabs'
import { RWAQueryZoneGuard } from './QueryZoneGuard'

/**
 * The top tab row of every /rwa page: the section tabs on a tree page, the page's own views on a platform or venue page (the
 * rule is getRwaPageTabRow). Every tab is a link; a view tab stays on the page, so it navigates shallow.
 */
export function RWAPageTabs({ kind, embedded = false }: { kind: RWAPageKind; embedded?: boolean }) {
	const router = useRouter()
	/* A static page renders on the server without its query, so the first client render reads the bare path too; the
	   query (?view=, filters) joins once the router is ready, and the tabs re-render then. */
	const path = router.isReady ? router.asPath : router.asPath.split('?')[0]
	const row = getRwaPageTabRow(kind, path, { embedded })
	const sameRoute = kind === 'platform' || kind === 'venue'
	return (
		<>
			{/* Every /rwa page renders this, an embedded one without a row, so the guard of its query zone sits here. */}
			<RWAQueryZoneGuard />
			{row ? (
				<nav className={tabTrackStyles} aria-label={row.label}>
					{row.tabs.map((tab) => (
						<TabLink
							as={BasicLink}
							key={tab.key}
							href={tab.href}
							shallow={sameRoute}
							aria-current={tab.current ? 'page' : undefined}
						>
							{tab.label}
						</TabLink>
					))}
				</nav>
			) : null}
		</>
	)
}
