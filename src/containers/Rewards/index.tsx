import {
	columnSizingFeature,
	columnVisibilityFeature,
	createPaginatedRowModel,
	createSortedRowModel,
	rowExpandingFeature,
	rowPaginationFeature,
	tableFeatures,
	useTable,
	type PaginationState
} from '@tanstack/react-table'
import { useRouter } from 'next/router'
import { useMemo, useState } from 'react'
import { ExternalLinkButton } from '~/components/ExternalLinkButton'
import { sortingFeatures } from '~/components/Table/features/sorting'
import { PaginatedTable } from '~/components/Table/PaginatedTable'
import { Button } from '~/ui/Button'
import { Checkbox } from '~/ui/Checkbox'
import { Icon } from '~/ui/Icon'
import { searchFieldIconStyles, searchFieldInlineWrapperStyles, searchFieldInputStyles } from '~/ui/Input'
import { NoResults } from '~/ui/NoResults'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { TableToolbar } from '~/ui/Toolbar'
import { pushShallowQuery } from '~/utils/routerQuery'
import { columns, renderProgramDetails } from './columns'
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

export default function Rewards({ programs, analyticsMode }: RewardsPageProps) {
	const router = useRouter()
	const query = useMemo(() => readRewardsQuery(router.query), [router.query])
	const [search, setSearch] = useState('')
	const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 50 })
	const view = useMemo(() => getRewardsView(programs, { ...query, search }), [programs, query, search])
	function updateQuery(patch: Partial<typeof query>) {
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
		onPaginationChange: setPagination
	})
	const analyticsRef = useRewardsAnalytics(analyticsMode, table.getRowModel().rows)
	return (
		<div ref={analyticsRef} className="flex flex-col gap-2">
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
							updateQuery(readRewardsQuery({}))
							setPagination({ pageIndex: 0, pageSize: 50 })
							table.resetExpanded()
							table.resetSorting()
						}}
					>
						Reset
					</Button>
					<ExternalLinkButton
						href="https://docs.google.com/forms/d/e/1FAIpQLSdx-uFrc7rWy7tIjjPCCbe3VXbcoWv4BFLH1DTDNrUj5fjK6Q/viewform?usp=dialog"
						icon="plus"
					>
						Add Your Rewards
					</ExternalLinkButton>
				</PanelHeader>
				<TableToolbar>
					<div role="group" aria-label="Lifecycle" className="flex flex-wrap items-center gap-1.5">
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
								onClick={() => updateQuery({ lifecycle: value })}
							>
								{value}
								<span className="body-xs text-tertiary">{view.lifecycleCounts[value]}</span>
							</Button>
						))}
					</div>
				</TableToolbar>
				<TableToolbar>
					<div role="group" aria-label="Reward type" className="flex flex-wrap items-center gap-1.5">
						<span className="mr-1 label-sm text-secondary">Reward</span>
						<Button
							type="button"
							size="md"
							variant="toggle"
							data-active={query.rewardTypes.length === 0}
							aria-pressed={query.rewardTypes.length === 0}
							onClick={() => updateQuery({ rewardTypes: [] })}
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
									onClick={() =>
										updateQuery({
											rewardTypes: active
												? query.rewardTypes.filter((type) => type !== value)
												: [...query.rewardTypes, value]
										})
									}
								>
									{value}
									<span className="body-xs text-tertiary">{view.rewardCounts[value]}</span>
								</Button>
							)
						})}
					</div>
				</TableToolbar>
				<p className="px-3 py-2 body-sm text-tertiary">
					<span role="status">{view.rows.length} matching programs.</span> Status is reviewed separately from dates;
					some dates may be approximate. Verification reflects a review of program information, not a security audit or
					endorsement.
				</p>
				<PaginatedTable
					table={table}
					pageSizeOptions={PAGE_SIZES}
					shell="none"
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
