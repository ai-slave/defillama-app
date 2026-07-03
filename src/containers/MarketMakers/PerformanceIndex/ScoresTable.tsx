import { getCoreRowModel, getSortedRowModel, type SortingState, useReactTable } from '@tanstack/react-table'
import * as React from 'react'
import { StickyTable } from '../StickyTable'
import { buildPerformanceColumns } from './columns'
import type { PerformanceRow } from './types'

interface IScoresTableProps {
	rows: PerformanceRow[]
	onSelectMM: (marketMakerId: string, marketMakerName: string) => void
}

export function ScoresTable({ rows, onSelectMM }: IScoresTableProps) {
	'use no memo'
	const [sorting, setSorting] = React.useState<SortingState>([{ id: '#', desc: true }])

	const rankById = React.useMemo(() => {
		const map = new Map<string, number>()
		;[...rows]
			.sort((a, b) => (b.composite ?? -Infinity) - (a.composite ?? -Infinity))
			.forEach((row, index) => map.set(row.marketMakerId, index + 1))
		return map
	}, [rows])

	const tableColumns = React.useMemo(() => buildPerformanceColumns({ onSelectMM, rankById }), [onSelectMM, rankById])

	const instance = useReactTable({
		data: rows,
		columns: tableColumns,
		state: { sorting },
		enableSortingRemoval: false,
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel()
	})

	return <StickyTable headerGroups={instance.getHeaderGroups()} rows={instance.getRowModel().rows} />
}
