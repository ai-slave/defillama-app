import * as React from 'react'
import { Button } from '~/ui/Button'
import type { Dashboard } from '../dashboardTypes'
import type { DiscoveryCategoriesInitialData } from '../discoveryCategories'
import { useDiscoveryCategories } from '../hooks/useDiscoveryCategories'
import { isLowQualityDashboardName } from './discoveryQuality'
import { DiscoverySection } from './DiscoverySection'
import { dedupeShelves, DISCOVERY_RAIL_SIZE } from './discoveryShelves'
import { flattenDiscoveryCategories, rankDiscoveryTags } from './discoveryTags'
import { TopAuthorsRail } from './TopAuthorsRail'

interface SectionConfig {
	key: string
	title: string
	subtitle: string
	seeAllHref: string
	emptyMessage: string
	keepDuplicates?: boolean
}

const EMPTY_DASHBOARDS: Array<Dashboard> = []

function curateShelf(dashboards: ReadonlyArray<Dashboard>): Array<Dashboard> {
	if (dashboards.length === 0) return EMPTY_DASHBOARDS
	return dashboards.filter((dashboard) => !isLowQualityDashboardName(dashboard.data.dashboardName))
}

const SECTIONS: Array<SectionConfig> = [
	{
		key: 'trendingToday',
		title: 'Trending today',
		subtitle: 'Most viewed in the last 24 hours',
		seeAllHref: '/pro?tab=discover&sortBy=trending&timeFrame=1d',
		emptyMessage: 'Nothing trending yet'
	},
	{
		key: 'trendingWeek',
		title: 'Trending this week',
		subtitle: 'Most viewed this week',
		seeAllHref: '/pro?tab=discover&sortBy=trending&timeFrame=7d',
		emptyMessage: 'Nothing trending this week'
	},
	{
		key: 'popular',
		title: 'Most popular',
		subtitle: 'Most viewed of all time',
		seeAllHref: '/pro?tab=discover&sortBy=popular',
		emptyMessage: 'No popular dashboards yet'
	},
	{
		key: 'recent',
		title: 'Recently created',
		subtitle: 'Newest public dashboards',
		seeAllHref: '/pro?tab=discover&sortBy=recent',
		emptyMessage: 'No new dashboards yet',
		keepDuplicates: true
	}
]

interface DashboardBrowseProps {
	onTagClick: (tag: string) => void
	initialCategories?: DiscoveryCategoriesInitialData | null
}

export function DashboardBrowse({ onTagClick, initialCategories }: DashboardBrowseProps) {
	const { categories } = useDiscoveryCategories(initialCategories)
	const trendingTags = rankDiscoveryTags(flattenDiscoveryCategories(categories))
	const shelves = React.useMemo(
		() =>
			dedupeShelves(
				SECTIONS.map((section) => ({
					key: section.key,
					dashboards: curateShelf(categories[section.key]?.dashboards ?? EMPTY_DASHBOARDS),
					...(section.keepDuplicates ? { keepDuplicates: true } : {})
				})),
				DISCOVERY_RAIL_SIZE
			),
		[categories]
	)

	return (
		<div className="flex flex-col gap-6">
			<div className="flex scrollbar-none items-center gap-2 overflow-x-auto pb-1">
				<span className="shrink-0 body-sm text-tertiary">Trending</span>
				{trendingTags.map((tag) => (
					<Button
						type="button"
						variant="secondary"
						size="sm"
						key={tag}
						onClick={() => onTagClick(tag)}
						data-umami-event="dashboard-tag-click"
						data-umami-event-tag={tag}
						className="shrink-0"
					>
						{tag}
					</Button>
				))}
			</div>

			{SECTIONS.map((section, index) => {
				const categoryData = categories[section.key]
				const dashboards = shelves[index]?.dashboards ?? EMPTY_DASHBOARDS
				return (
					<React.Fragment key={section.key}>
						<DiscoverySection
							title={section.title}
							subtitle={section.subtitle}
							dashboards={dashboards}
							isLoading={categoryData?.isLoading ?? true}
							seeAllHref={section.seeAllHref}
							emptyMessage={section.emptyMessage}
							onTagClick={onTagClick}
						/>
						{index === 0 ? <TopAuthorsRail /> : null}
					</React.Fragment>
				)
			})}
		</div>
	)
}
