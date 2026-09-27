import {
	columnSizingFeature,
	columnVisibilityFeature,
	createPaginatedRowModel,
	createSortedRowModel,
	functionalUpdate,
	makeStateUpdater,
	rowExpandingFeature,
	rowPaginationFeature,
	tableFeatures,
	useTable,
	type PaginationState
} from '@tanstack/react-table'
import { useRouter } from 'next/router'
import { useEffect, useEffectEvent, useMemo, useState, useSyncExternalStore } from 'react'
import { ExternalLinkButton } from '~/components/ExternalLinkButton'
import { sortingFeatures } from '~/components/Table/features/sorting'
import { PaginatedTable } from '~/components/Table/PaginatedTable'
import { Button } from '~/ui/Button'
import { Checkbox } from '~/ui/Checkbox'
import { Icon } from '~/ui/Icon'
import { searchFieldIconStyles, searchFieldInlineWrapperStyles, searchFieldInputStyles } from '~/ui/Input'
import { NoResults } from '~/ui/NoResults'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { getABGroupFromCookie } from '~/utils/abTesting'
import { REWARDS_EVENTS, trackRewardsEvent } from '~/utils/analytics/rewards'
import { pushShallowQuery } from '~/utils/routerQuery'
import { columns, renderProgramDetails } from './columns'
import { FeaturedCards } from './FeaturedCards'
import { readRewardsQuery, serializeRewardsQuery } from './query'
import { LIFECYCLES, REWARD_TYPES, type RewardsPageProps } from './types'
import { useRewardsAnalytics } from './useRewardsAnalytics'
import { getRewardsView } from './utils'

export const tableFeaturesConfig = tableFeatures({
	rowExpandingFeature,
	...sortingFeatures,
	columnVisibilityFeature,
	columnSizingFeature,
	rowPaginationFeature,
	sortedRowModel: createSortedRowModel(),
	paginatedRowModel: createPaginatedRowModel()
})

const PAGE_SIZES = [10, 25, 50, 100] as const
const LIFECYCLE_OPTIONS = ['All', ...LIFECYCLES] as const

// Assignment is established by _app before hydration and stays fixed for the visit.
const subscribeToAssignment = () => () => {}
const getAssignment = () => getABGroupFromCookie(document.cookie) ?? 'a'
const getServerAssignment = () => null

export default function Rewards({ programs, popularityOrder, featuredCardIds }: RewardsPageProps) {
	const assignment = useSyncExternalStore(subscribeToAssignment, getAssignment, getServerAssignment)
	const variant = assignment ?? 'a'
	const programsById = useMemo(() => new Map(programs.map((program) => [program.programId, program])), [programs])
	const orderedPrograms = useMemo(
		() => (variant === 'b' ? popularityOrder.map((id) => programsById.get(id)!) : programs),
		[variant, popularityOrder, programsById, programs]
	)
	const router = useRouter()
	const query = useMemo(() => readRewardsQuery(router.query), [router.query])
	const [search, setSearch] = useState('')
	const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 50 })
	const view = useMemo(() => getRewardsView(orderedPrograms, { ...query, search }), [orderedPrograms, query, search])
	const searchTerm = search.trim().toLowerCase()
	const trackSearch = useEffectEvent(() => {
		trackRewardsEvent(REWARDS_EVENTS.SEARCH, { variant, term: searchTerm, results: view.rows.length })
	})
	useEffect(() => {
		if (!search.trim()) return
		const timer = setTimeout(trackSearch, 600)
		return () => clearTimeout(timer)
	}, [search])
	function updateQuery(patch: Partial<typeof query>) {
		if (patch.lifecycle !== undefined) {
			trackRewardsEvent(REWARDS_EVENTS.FILTER_STATUS, { variant, value: patch.lifecycle })
		}
		if (patch.hideUnverified !== undefined) {
			trackRewardsEvent(REWARDS_EVENTS.FILTER_HIDE_UNVERIFIED, { variant, value: patch.hideUnverified })
		}
		void pushShallowQuery(router, serializeRewardsQuery({ ...query, ...patch }))
	}
	const table = useTable({
		features: tableFeaturesConfig,
		data: view.rows,
		columns,
		getRowId: (row) => row.programId,
		getRowCanExpand: () => true,
		state: { pagination },
		enableMultiSort: false,
		onPaginationChange: setPagination,
		onSortingChange: (updater) => {
			const previous = table.atoms.sorting.get()
			const next = functionalUpdate(updater, previous)
			makeStateUpdater('sorting', table)(next)
			const sorting = next[0] ?? previous[0]
			if (sorting) {
				trackRewardsEvent(REWARDS_EVENTS.TABLE_SORT, {
					variant,
					column: sorting.id,
					direction: next.length === 0 ? 'none' : sorting.desc ? 'desc' : 'asc'
				})
			}
		},
		onExpandedChange: (updater) => {
			const previous = table.atoms.expanded.get()
			const next = functionalUpdate(updater, previous)
			makeStateUpdater('expanded', table)(next)
			for (const program of view.rows) {
				const wasExpanded = previous === true || previous[program.programId]
				const isExpanded = next === true || next[program.programId]
				if (isExpanded && !wasExpanded) {
					trackRewardsEvent(REWARDS_EVENTS.ROW_EXPAND, {
						variant,
						program_id: program.programId,
						project_path: program.projectPath
					})
				}
			}
		}
	})
	const hasActiveFilters =
		search.trim() !== '' || query.lifecycle !== 'All' || query.rewardTypes.length > 0 || query.hideUnverified
	const cards = useMemo(
		() => (variant === 'b' && !hasActiveFilters ? featuredCardIds.map((id) => programsById.get(id)!) : []),
		[variant, hasActiveFilters, featuredCardIds, programsById]
	)
	const analyticsRef = useRewardsAnalytics(assignment, table.getRowModel().rows, cards)
	return (
		<div
			ref={analyticsRef}
			data-rewards-variant={variant}
			data-ab-variant={assignment === null ? 'a' : undefined}
			className="flex flex-col gap-2"
		>
			<Panel padding="none">
				<PanelHeader>
					<PanelTitle as="h1">Rewards</PanelTitle>
					<label className={searchFieldInlineWrapperStyles}>
						<span className="sr-only">Search protocols or programs</span>
						<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
						<input
							type="search"
							value={search}
							onChange={(event) => setSearch(event.currentTarget.value)}
							placeholder="Search protocols or programs..."
							className={searchFieldInputStyles}
						/>
					</label>
					{/* filter, not inline: it sits between the search field and Reset, so it
					    takes the same 32px bordered control shape (design.md → Table toolbar). */}
					<Checkbox
						variant="filter"
						checked={query.hideUnverified}
						onChange={(event) => updateQuery({ hideUnverified: event.target.checked })}
					>
						Hide unverified
						<span className="body-xs text-tertiary">{view.unverified}</span>
					</Checkbox>
					<Button
						type="button"
						size="md"
						onClick={() => {
							setSearch('')
							trackRewardsEvent(REWARDS_EVENTS.FILTER_RESET, { variant })
							void pushShallowQuery(router, serializeRewardsQuery(readRewardsQuery({})))
							setPagination({ pageIndex: 0, pageSize: 50 })
							table.resetExpanded()
							makeStateUpdater('sorting', table)(table.initialState.sorting)
						}}
					>
						Reset
					</Button>
					<ExternalLinkButton
						href="https://docs.google.com/forms/d/e/1FAIpQLSdx-uFrc7rWy7tIjjPCCbe3VXbcoWv4BFLH1DTDNrUj5fjK6Q/viewform?usp=dialog"
						icon="plus"
						data-reward-submit="true"
					>
						Add Your Rewards
					</ExternalLinkButton>
				</PanelHeader>
				<div role="group" aria-label="Lifecycle" className="flex flex-wrap items-center gap-1.5 p-2">
					<span className="mr-1 label-sm text-secondary">Status</span>
					{LIFECYCLE_OPTIONS.filter(
						(value) => value === 'All' || value === query.lifecycle || view.availableLifecycles.has(value)
					).map((value) => (
						<Button
							key={value}
							type="button"
							size="md"
							variant="toggle"
							data-active={query.lifecycle === value}
							aria-pressed={query.lifecycle === value}
							onClick={() => {
								if (value !== query.lifecycle) updateQuery({ lifecycle: value })
							}}
						>
							{value}
							<span className="body-xs text-tertiary">{view.lifecycleCounts[value]}</span>
						</Button>
					))}
				</div>
				<FeaturedCards programs={cards} />
				<div role="group" aria-label="Reward type" className="flex flex-wrap items-center gap-1.5 p-2">
					<span className="mr-1 label-sm text-secondary">Reward</span>
					<Button
						type="button"
						size="md"
						variant="toggle"
						data-active={query.rewardTypes.length === 0}
						aria-pressed={query.rewardTypes.length === 0}
						onClick={() => {
							if (query.rewardTypes.length === 0) return
							trackRewardsEvent(REWARDS_EVENTS.FILTER_REWARD_TYPE, { variant, value: 'All', selected: true })
							updateQuery({ rewardTypes: [] })
						}}
					>
						All
					</Button>
					{REWARD_TYPES.filter(
						(value) => view.availableRewardTypes.has(value) || query.rewardTypes.includes(value)
					).map((value) => {
						const active = query.rewardTypes.includes(value)
						return (
							<Button
								key={value}
								type="button"
								size="md"
								variant="toggle"
								data-active={active}
								aria-pressed={active}
								onClick={() => {
									trackRewardsEvent(REWARDS_EVENTS.FILTER_REWARD_TYPE, { variant, value, selected: !active })
									updateQuery({
										rewardTypes: active
											? query.rewardTypes.filter((type) => type !== value)
											: [...query.rewardTypes, value]
									})
								}}
							>
								{value}
								<span className="body-xs text-tertiary">{view.rewardCounts[value]}</span>
							</Button>
						)
					})}
				</div>
				<p className="px-3 py-2 body-sm text-tertiary">
					<span role="status">{view.rows.length} matching programs.</span> Status is reviewed separately from dates;
					some dates may be approximate. Verification reflects a review of program information, not a security audit or
					endorsement.
				</p>
				<PaginatedTable
					table={table}
					pageSizeOptions={PAGE_SIZES}
					tableClassName="min-w-max!"
					renderSubComponent={renderProgramDetails}
				/>
				{view.rows.length === 0 ? (
					<NoResults>No programs match these filters. Try another status or reset the filters.</NoResults>
				) : null}
			</Panel>
			<p className="px-2 body-sm text-secondary">
				Programs and eligibility can change. Check the linked terms before participating. Some links are referral links;
				DefiLlama may receive a benefit.
			</p>
		</div>
	)
}
