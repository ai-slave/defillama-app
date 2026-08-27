import { ButtonLink } from '~/components/Link'
import { TabLink, tabTrackStyles } from '~/ui/Tab'

const tabs = [
	{ id: 'overview', name: 'Overview', route: '/rwa/perps' },
	{ id: 'venues', name: 'Venues', route: '/rwa/perps/venues' },
	{ id: 'assets', name: 'By Asset', route: '/rwa/perps/assets' },
	{ id: 'assetGroups', name: 'Asset Groups', route: '/rwa/perps/asset-groups' },
	{ id: 'forex', name: 'Forex', route: '/rwa/perps/forex' }
] as const

export type RWAPerpsTab = (typeof tabs)[number]['id']

export function RWAPerpsTabNav({ active }: { active: RWAPerpsTab }) {
	return (
		<nav className={tabTrackStyles}>
			{tabs.map((tab) => (
				<TabLink as={ButtonLink} key={tab.id} href={tab.route} data-active={tab.id === active}>
					{tab.name}
				</TabLink>
			))}
		</nav>
	)
}
