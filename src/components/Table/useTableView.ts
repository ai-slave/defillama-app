import { shallow, useSelector } from '@tanstack/react-store'
import type { RowData, Table_ColumnVisibility, Table as TableInstance } from '@tanstack/react-table'
import { useRouter } from 'next/router'
import { useMemo } from 'react'
import type { SortingFeatures, VisibilityFeatures } from './features/contracts'

export function useTableView<F extends SortingFeatures & VisibilityFeatures, T extends RowData>(
	table: TableInstance<F, T> & Table_ColumnVisibility<F, T>
) {
	const router = useRouter()
	const { rows, headerGroups, columns } = useSelector(
		table.store,
		() => ({
			rows: table.getRowModel().rows,
			headerGroups: table.getHeaderGroups(),
			columns: table.getVisibleLeafColumns()
		}),
		{ compare: shallow }
	)
	const visibleLeafColumns = useMemo(
		() => columns.filter((column) => !column.id.startsWith('__group_') && !column.columnDef.meta?.hidden),
		[columns]
	)
	const subRowOrdinalById = useMemo(() => {
		const ordById = new Map<string, number>()
		const perParent = new Map<string, number>()

		for (const r of rows) {
			if (r.depth > 0) {
				const parentId = r.parentId!
				const next = (perParent.get(parentId) ?? 0) + 1
				perParent.set(parentId, next)
				ordById.set(r.id, next)
			}
		}

		return ordById
	}, [rows])

	return {
		columns,
		rows,
		headerGroups,
		visibleLeafColumns,
		subRowOrdinalById,
		isChainPage:
			router.pathname === '/' || router.pathname.startsWith('/chain') || router.pathname.startsWith('/protocols')
	}
}
