import { ButtonLink } from '~/components/Link'
import { TabLink, tabTrackStyles } from '~/ui/Tab'

const tabs = [
	{ id: 'overview', name: 'Overview', route: '/rwa' },
	{ id: 'chains', name: 'Chains', route: '/rwa/chains' },
	{ id: 'platforms', name: 'Platforms', route: '/rwa/platforms' },
	{ id: 'assetGroups', name: 'Asset Groups', route: '/rwa/asset-groups' },
	{ id: 'categories', name: 'Categories', route: '/rwa/categories' }
] as const

export type RWATab = (typeof tabs)[number]['id']

export function RWATabNav({ active }: { active: RWATab }) {
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
