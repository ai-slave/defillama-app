import { useRouter } from 'next/router'
import { useMemo, useRef } from 'react'
import { BasicLink } from '~/components/Link'
import { Select } from '~/components/Select/Select'
import { Button } from '~/ui/Button'
import { neighbourRowControl, passFocusOnLeave } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { SegmentedControl } from '~/ui/SegmentedControl'
import type { SegmentedControlOption } from '~/ui/SegmentedControl'
import { Tooltip } from '~/ui/Tooltip'
import { pushShallowQuery } from '~/utils/routerQuery'
import type { DiscoveryCategoriesInitialData } from '../discoveryCategories'
import { useDashboardDiscovery } from '../hooks/useDashboardDiscovery'
import { useDiscoveryCategories } from '../hooks/useDiscoveryCategories'
import { DashboardBrowse } from './DashboardBrowse'
import { DashboardCard } from './DashboardCard'
import { DashboardSearch } from './DashboardSearch'
import { flattenDiscoveryCategories, rankDiscoveryTags } from './discoveryTags'
import { LoadingSkeleton } from './LoadingSkeleton'

const viewModes = ['grid', 'list'] as const
type ViewMode = (typeof viewModes)[number]
const isViewMode = (value: string): value is ViewMode => viewModes.some((candidate) => candidate === value)
const VIEW_MODE_OPTIONS: Array<SegmentedControlOption<ViewMode>> = [
	{
		value: 'grid',
		label: <Icon name="layout-grid" height={16} width={16} />,
		ariaLabel: 'Grid view',
		tooltip: 'Grid view'
	},
	{ value: 'list', label: <Icon name="menu" height={16} width={16} />, ariaLabel: 'List view', tooltip: 'List view' }
]
const DEFAULT_PAGE_LIMIT = 20
const itemsPerPageOptions = [
	{ key: '20', name: '20' },
	{ key: '40', name: '40' },
	{ key: '100', name: '100' }
] as const
const sortOptions = [
	{ key: 'popular', name: 'Most popular' },
	{ key: 'recent', name: 'Recently created' },
	{ key: 'likes', name: 'Most starred' },
	{ key: 'trending', name: 'Trending' }
] as const
type SortOption = (typeof sortOptions)[number]
type SortOptionKey = SortOption['key']
const isSortOptionKey = (value: string): value is SortOptionKey => sortOptions.some((option) => option.key === value)
const timeFrameOptions = [
	{ key: '1d', name: 'Last 24 hours' },
	{ key: '7d', name: 'Last 7 days' },
	{ key: '30d', name: 'Last 30 days' }
] as const
type TimeFrameOption = (typeof timeFrameOptions)[number]
type TimeFrameOptionKey = TimeFrameOption['key']
const isTimeFrameOptionKey = (value: string): value is TimeFrameOptionKey =>
	timeFrameOptions.some((option) => option.key === value)

const toPageQueryValue = (targetPage: number) => (targetPage === 1 ? undefined : targetPage)

function SuggestedTags({
	initialCategories,
	selectedTags,
	onTagClick
}: {
	initialCategories?: DiscoveryCategoriesInitialData | null
	selectedTags: ReadonlyArray<string>
	onTagClick: (tag: string) => void
}) {
	const { categories } = useDiscoveryCategories(initialCategories)
	const alreadySelected = new Set(selectedTags.map((tag) => tag.trim().toLowerCase()))
	const suggestedTags = rankDiscoveryTags(flattenDiscoveryCategories(categories)).filter(
		(tag) => !alreadySelected.has(tag.toLowerCase())
	)
	if (suggestedTags.length === 0) return null

	return (
		<div className="flex flex-col items-center gap-3">
			<p className="text-sm font-medium text-pro-text-label">Try these popular tags:</p>
			<div className="flex flex-wrap justify-center gap-2">
				{suggestedTags.map((tag) => (
					<Button
						type="button"
						variant="secondary"
						size="sm"
						key={tag}
						onClick={() => onTagClick(tag)}
						data-umami-event="dashboard-tag-click"
						data-umami-event-tag={tag}
					>
						{tag}
					</Button>
				))}
			</div>
		</div>
	)
}

export function DashboardDiscovery({
	initialCategories
}: {
	initialCategories?: DiscoveryCategoriesInitialData | null
}) {
	const router = useRouter()
	const searchRef = useRef<HTMLInputElement>(null)
	const { view, tag: tagQuery, sortBy, query, page: pageQuery, limit, timeFrame } = router.query
	const pushProQuery = (updates: Record<string, string | number | Array<string> | undefined>) => {
		void pushShallowQuery(router, updates, '/pro')
	}

	const {
		isBrowseMode,
		viewMode,
		selectedTags,
		selectedSortBy,
		selectedTimeFrame,
		searchQuery,
		selectedPage,
		itemsPerPage
	} = useMemo(() => {
		const viewMode = typeof view === 'string' && isViewMode(view) ? view : 'grid'
		const selectedTags = tagQuery ? (typeof tagQuery === 'string' ? [tagQuery] : tagQuery) : []
		const selectedSortBy =
			typeof sortBy === 'string'
				? (sortOptions.find((option) => option.key === sortBy) ?? sortOptions[0])
				: sortOptions[0]
		const selectedTimeFrame =
			typeof timeFrame === 'string'
				? (timeFrameOptions.find((option) => option.key === timeFrame) ?? timeFrameOptions[1])
				: timeFrameOptions[1]
		const searchQuery = typeof query === 'string' ? query : ''
		const selectedPage = typeof pageQuery === 'string' && !Number.isNaN(Number(pageQuery)) ? parseInt(pageQuery, 10) : 1

		let itemsPerPage = DEFAULT_PAGE_LIMIT
		if (typeof limit === 'string' && !Number.isNaN(Number(limit))) {
			const parsed = parseInt(limit, 10)
			if (itemsPerPageOptions.some((option) => option.key === parsed.toString())) {
				itemsPerPage = parsed
			}
		}

		const isBrowseMode = !query && !tagQuery && !sortBy && !pageQuery

		return {
			isBrowseMode,
			viewMode,
			selectedTags,
			selectedSortBy,
			selectedTimeFrame,
			searchQuery,
			selectedPage,
			itemsPerPage
		}
	}, [view, tagQuery, sortBy, query, pageQuery, limit, timeFrame])

	const { dashboards, isLoading, totalPages, totalItems } = useDashboardDiscovery({
		query: searchQuery,
		tags: selectedTags,
		visibility: 'public',
		sortBy: selectedSortBy.key,
		...(selectedSortBy.key === 'trending' ? { timeFrame: selectedTimeFrame.key } : {}),
		page: selectedPage,
		limit: itemsPerPage
	})

	const handleTagClick = (tag: string) => {
		if (router.query.tag && router.query.tag.includes(tag)) {
			return
		}

		// remove page from query
		const { tag: currentTag } = router.query

		const existingTags = currentTag ? (Array.isArray(currentTag) ? currentTag : [currentTag]) : []

		pushProQuery({
			page: undefined,
			tag: [...existingTags, tag]
		})
	}

	const handleItemsPerPageChange = (value: string) => {
		const newItemsPerPage = parseInt(value, 10)
		pushProQuery({ page: undefined, limit: newItemsPerPage })
	}

	const pagesToShow = useMemo(() => {
		let pages: Array<number>
		if (selectedPage === 1) {
			pages = [1, 2, 3]
		} else if (selectedPage === totalPages) {
			pages = [totalPages - 2, totalPages - 1, totalPages]
		} else {
			pages = [selectedPage - 1, selectedPage, selectedPage + 1]
		}
		return pages.filter((page) => page > 0 && page <= totalPages)
	}, [totalPages, selectedPage])

	return (
		<>
			<div className="flex flex-col gap-1">
				{!isBrowseMode ? (
					<nav className="flex items-center gap-1 text-sm">
						<BasicLink href="/pro?tab=discover" shallow className="text-pro-accent hover:underline">
							Discover
						</BasicLink>
						<Icon name="chevron-right" height={14} width={14} className="text-pro-text-label" />
						<span className="text-pro-text-label">
							{selectedSortBy.name}
							{selectedSortBy.key === 'trending' ? ` (${selectedTimeFrame.name})` : ''}
						</span>
					</nav>
				) : null}

				<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
					<DashboardSearch ref={searchRef} defaultValue={searchQuery} />

					{!isBrowseMode ? (
						<div className="ml-auto flex flex-wrap items-center gap-4">
							<Select
								heading="Items per page"
								variant="filter"
								size="md"
								allValues={itemsPerPageOptions}
								selectedValues={itemsPerPage.toString()}
								setSelectedValues={handleItemsPerPageChange}
								label={
									<>
										<span className="text-pro-text-label">Items per page:</span>
										<span className="truncate">{itemsPerPage}</span>
									</>
								}
								labelType="none"
								triggerProps={{ 'aria-label': 'Items per page' }}
							/>
							<Select
								heading="Sort by"
								variant="filter"
								size="md"
								allValues={sortOptions}
								selectedValues={selectedSortBy.key}
								setSelectedValues={(value: string) => {
									if (!isSortOptionKey(value)) return
									const updates: Record<string, string | number | Array<string> | undefined> = {
										page: undefined,
										sortBy: value
									}
									if (value === 'trending') {
										updates.timeFrame = '7d'
									}
									pushProQuery(updates)
								}}
								label={
									<>
										<span className="text-pro-text-label">Sort by:</span>
										<span className="truncate">{selectedSortBy.name}</span>
									</>
								}
								labelType="none"
								triggerProps={{ 'aria-label': 'Sort by' }}
							/>
							{selectedSortBy.key === 'trending' ? (
								<Select
									heading="Time frame"
									variant="filter"
									size="md"
									allValues={timeFrameOptions}
									selectedValues={selectedTimeFrame.key}
									setSelectedValues={(value: string) => {
										if (!isTimeFrameOptionKey(value)) return
										pushProQuery({
											page: undefined,
											timeFrame: value
										})
									}}
									label={
										<>
											<span className="text-pro-text-label">Time:</span>
											<span className="truncate">{selectedTimeFrame.name}</span>
										</>
									}
									labelType="none"
									triggerProps={{ 'aria-label': 'Time frame' }}
								/>
							) : null}

							<SegmentedControl
								variant="default"
								size="md"
								label="View"
								options={VIEW_MODE_OPTIONS}
								value={viewMode}
								onValueChange={(mode) => pushProQuery({ view: mode })}
							/>
						</div>
					) : null}
				</div>

				{selectedTags.length > 0 ? (
					<div className="mt-2 flex items-center gap-3 text-xs">
						<h2 className="font-medium text-pro-text-label">Active filters:</h2>
						<div className="flex flex-wrap gap-2">
							{selectedTags.map((tag) => (
								<Button
									type="button"
									variant="filter"
									size="sm"
									key={`pro-dashboard-tag-${tag}`}
									data-active
									ref={passFocusOnLeave((node) => neighbourRowControl(node, node) ?? searchRef.current)}
									onClick={() => {
										const { tag: currentTag } = router.query
										let nextTag: Array<string> | undefined
										if (Array.isArray(currentTag)) {
											const filteredTags = currentTag.filter((t) => t !== tag)
											nextTag = filteredTags.length > 0 ? filteredTags : undefined
										} else if (currentTag === tag) {
											nextTag = undefined
										} else {
											return
										}
										pushProQuery({ tag: nextTag })
									}}
								>
									<span className="sr-only">Remove filter </span>
									<span>{tag}</span>
									<Icon name="x" height={14} width={14} />
								</Button>
							))}
						</div>
						<Button
							variant="ghost"
							size="sm"
							ref={passFocusOnLeave(() => searchRef.current)}
							onClick={() => {
								pushProQuery({ tag: undefined })
							}}
						>
							Clear all
						</Button>
					</div>
				) : null}
			</div>

			{isBrowseMode ? (
				<DashboardBrowse
					onTagClick={handleTagClick}
					{...(initialCategories !== undefined ? { initialCategories } : {})}
				/>
			) : isLoading ? (
				<>
					<p className="-mb-2 text-xs text-pro-text-label">Loading dashboards…</p>
					<LoadingSkeleton viewMode={viewMode} items={DEFAULT_PAGE_LIMIT} />
				</>
			) : dashboards.length === 0 ? (
				<div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-pro-cards-border bg-pro-cards-bg px-6 py-16">
					<div className="flex size-20 items-center justify-center rounded-full bg-pro-hover-fill">
						<Icon name="search" height={40} width={40} className="text-pro-text-label" />
					</div>

					<div className="flex flex-col items-center gap-1.5">
						<h1 className="text-center text-2xl font-bold">No Dashboards Found</h1>
						<p className="max-w-md text-center text-pro-text-label">
							{searchQuery || selectedTags.length > 0
								? "We couldn't find any dashboards matching your search. Try different keywords or explore popular tags below."
								: 'Be the first to share a public dashboard with the community!'}
						</p>
					</div>

					{searchQuery || selectedTags.length > 0 ? (
						<SuggestedTags
							selectedTags={selectedTags}
							onTagClick={handleTagClick}
							{...(initialCategories !== undefined ? { initialCategories } : {})}
						/>
					) : null}

					<div className="mt-2 flex items-center gap-3">
						<div className="h-px w-12 bg-pro-cards-border" />
						<span className="text-xs text-pro-text-label">or</span>
						<div className="h-px w-12 bg-pro-cards-border" />
					</div>

					<Button as={BasicLink} href="/pro?tab=dashboard" variant="primary" size="md">
						<Icon name="plus" height={14} width={14} />
						Create Your First Dashboard
					</Button>
				</div>
			) : (
				<>
					<p className="-mb-2 text-xs text-pro-text-label">
						Showing {dashboards.length} of {totalItems} dashboards
					</p>

					<div
						className={
							viewMode === 'grid' ? 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4' : 'space-y-4'
						}
					>
						{dashboards.map((dashboard) => (
							<DashboardCard key={dashboard.id} dashboard={dashboard} onTagClick={handleTagClick} viewMode={viewMode} />
						))}
					</div>

					{totalPages > 1 ? (
						<div className="flex flex-col items-center gap-4">
							<div className="flex flex-nowrap items-center justify-center gap-2 overflow-x-auto">
								<Tooltip
									content="First page"
									render={
										<Button
											size="md"
											variant="ghost"
											square
											aria-label="First page"
											onClick={() => pushProQuery({ page: toPageQueryValue(1) })}
											disabled={selectedPage < 3}
											accessibleWhenDisabled
										/>
									}
								>
									<Icon name="chevrons-left" height={16} width={16} />
								</Tooltip>
								<Tooltip
									content="Previous page"
									render={
										<Button
											size="md"
											variant="ghost"
											square
											aria-label="Previous page"
											onClick={() => pushProQuery({ page: toPageQueryValue(Math.max(1, selectedPage - 1)) })}
											disabled={selectedPage === 1}
											accessibleWhenDisabled
										/>
									}
								>
									<Icon name="chevron-left" height={16} width={16} />
								</Tooltip>
								{pagesToShow.map((pageNum) => {
									const isActive = selectedPage === pageNum
									return (
										<Button
											size="md"
											key={`page-to-navigate-to-${pageNum}`}
											variant="ghost"
											data-active={isActive}
											aria-current={isActive ? 'page' : undefined}
											onClick={() => pushProQuery({ page: toPageQueryValue(pageNum) })}
										>
											{pageNum}
										</Button>
									)
								})}
								<Tooltip
									content="Next page"
									render={
										<Button
											size="md"
											variant="ghost"
											square
											aria-label="Next page"
											onClick={() => pushProQuery({ page: toPageQueryValue(Math.min(totalPages, selectedPage + 1)) })}
											disabled={selectedPage === totalPages}
											accessibleWhenDisabled
										/>
									}
								>
									<Icon name="chevron-right" height={16} width={16} />
								</Tooltip>
								<Tooltip
									content="Last page"
									render={
										<Button
											size="md"
											variant="ghost"
											square
											aria-label="Last page"
											onClick={() => pushProQuery({ page: toPageQueryValue(totalPages) })}
											disabled={selectedPage > totalPages - 2}
											accessibleWhenDisabled
										/>
									}
								>
									<Icon name="chevrons-right" height={16} width={16} />
								</Tooltip>
							</div>
							<p className="text-xs text-pro-text-label">
								Page {selectedPage} of {totalPages}
							</p>
						</div>
					) : null}
				</>
			)}
		</>
	)
}
