import type { PaginationState, SortingState, TableOptions } from '@tanstack/react-table'
import { startTransition, useState } from 'react'
import type { paginatedTableFeatures } from '~/components/Table/features/pagination'
import { usePaginatedTable } from '~/components/Table/features/pagination'
import { PaginatedTable } from '~/components/Table/PaginatedTable'
import { Panel } from '~/ui/Panel'
import { trackYieldsEvent, YIELDS_EVENTS } from '~/utils/analytics/yields'
import type { IYieldsTableProps } from './types'

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100, 200] as const

const EMPTY_SORTING_STATE: SortingState = []

export function PaginatedYieldsTable<TRow>({
	data,
	columns,
	tableClassName,
	initialPageSize,
	initialPageIndex = 0,
	rowCount,
	manualPagination = false,
	manualSorting = false,
	paginationState,
	sortingState = EMPTY_SORTING_STATE,
	onPaginationChange,
	onSortingChange,
	interactionDisabled = false,
	loadingLabel,
	shell = 'default'
}: IYieldsTableProps<TRow> & {
	columns: TableOptions<typeof paginatedTableFeatures, TRow>['columns']
	tableClassName: string
	initialPageSize: number
	shell?: 'default' | 'none'
}) {
	const [localSorting, setLocalSorting] = useState<SortingState>(() => [...sortingState])
	const [localPagination, setLocalPagination] = useState<PaginationState>({
		pageIndex: initialPageIndex,
		pageSize: initialPageSize
	})
	const sorting = onSortingChange ? sortingState : localSorting
	const pagination = paginationState ?? localPagination

	const table = usePaginatedTable({
		data,
		columns,
		state: { sorting, pagination },
		defaultColumn: { sortUndefined: 'last' },
		...(manualPagination && rowCount !== undefined ? { rowCount } : {}),
		manualPagination,
		manualSorting,
		enableSortingRemoval: false,
		onSortingChange: (updater) =>
			startTransition(() => {
				const next = typeof updater === 'function' ? updater(sorting) : updater
				if (next.length > 0) trackYieldsEvent(YIELDS_EVENTS.TABLE_SORT, { column: next[0]!.id, desc: next[0]!.desc })
				if (!onSortingChange) setLocalSorting(next)
				onSortingChange?.(next)
			}),
		onPaginationChange: (updater) =>
			startTransition(() => {
				const next = typeof updater === 'function' ? updater(pagination) : updater
				if (!paginationState) setLocalPagination(next)
				onPaginationChange?.(next)
			}),
		autoResetPageIndex: false
	})

	const tableContent = (
		<PaginatedTable
			table={table}
			tableClassName={tableClassName}
			pageSizeOptions={PAGE_SIZE_OPTIONS}
			interactionDisabled={interactionDisabled}
			{...(loadingLabel ? { loadingLabel } : {})}
		/>
	)

	if (shell === 'none') return tableContent

	return (
		<Panel padding="none">
			{/* The Panel owns the border; clip table backgrounds without changing generic Panel overflow. */}
			<div className="overflow-clip rounded-[inherit]">{tableContent}</div>
		</Panel>
	)
}
