import {
	getCoreRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	functionalUpdate,
	useReactTable,
	type PaginationState,
	type SortingState
} from '@tanstack/react-table'
import { useRouter } from 'next/router'
import { useMemo, useState } from 'react'
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
import { getRewardsView } from './utils'

const PAGE_SIZES = [10, 25, 50, 100] as const
// Ranking accessors participate in sorting without adding visible columns.
const COLUMN_VISIBILITY = { fees30d: false, tvl: false }
const LIFECYCLE_OPTIONS = ['All', ...LIFECYCLES] as const

export default function Rewards({ programs }: RewardsPageProps) {
	const router = useRouter()
	const query = useMemo(() => readRewardsQuery(router.query), [router.query])
	const [search, setSearch] = useState('')
	const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 50 })
	const view = useMemo(() => getRewardsView(programs, { ...query, search }), [programs, query, search])
	const sorting = useMemo<SortingState>(() => [{ id: query.sort, desc: query.desc }], [query.sort, query.desc])
	function updateQuery(patch: Partial<typeof query>) {
		void pushShallowQuery(router, serializeRewardsQuery({ ...query, ...patch }))
	}
	const table = useReactTable({
		data: view.rows,
		columns,
		getRowId: (row) => row.programId,
		getRowCanExpand: () => true,
		state: { sorting, pagination, columnVisibility: COLUMN_VISIBILITY },
		enableMultiSort: false,
		enableSortingRemoval: false,
		onSortingChange: (updater) => {
			const next = functionalUpdate(updater, sorting)[0]
			if (next) updateQuery({ sort: readRewardsQuery({ sort: next.id }).sort, desc: next.desc })
		},
		onPaginationChange: setPagination,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel()
	})
	return (
		<div className="flex flex-col gap-2">
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
						}}
					>
						Reset
					</Button>
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
