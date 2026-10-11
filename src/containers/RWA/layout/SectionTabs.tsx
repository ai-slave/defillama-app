import { useRouter } from 'next/router'
import { BasicLink } from '~/components/Link'
import { TabLink, TabNav } from '~/ui/Tabs'
import { readyAsPath } from '~/utils/routerQuery'
import type { RWAPageKind } from './pageLayout'
import { getRwaPageTabRow } from './pageTabs'
import { RWAQueryZoneGuard } from './QueryZoneGuard'

/**
 * The top tab row of every /rwa page: the section tabs on a tree page, the page's own views on a platform or venue page (the
 * rule is getRwaPageTabRow). Every tab is a link; a view tab stays on the page, so it navigates shallow.
 */
export function RWAPageTabs({ kind, embedded = false }: { kind: RWAPageKind; embedded?: boolean }) {
	const router = useRouter()
	const row = getRwaPageTabRow(kind, readyAsPath(router), { embedded })
	const sameRoute = kind === 'platform' || kind === 'venue'
	return (
		<>
			{/* Every /rwa page renders this, an embedded one without a row, so the guard of its query zone sits here. */}
			<RWAQueryZoneGuard />
			{row ? (
				<TabNav label={row.label}>
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
				</TabNav>
			) : null}
		</>
	)
}
