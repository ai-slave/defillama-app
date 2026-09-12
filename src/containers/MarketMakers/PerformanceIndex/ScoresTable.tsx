import { type SortingState, useTable } from '@tanstack/react-table'
import * as React from 'react'
import { sortedTableFeatures } from '~/components/Table/features/sorting'
import { StickyTable } from '../StickyTable'
import { buildPerformanceColumns } from './columns'
import type { PerformanceRow } from './types'

interface IScoresTableProps {
	rows: Array<PerformanceRow>
	onSelectMM: (marketMakerId: string, marketMakerName: string) => void
}

export function ScoresTable({ rows, onSelectMM }: IScoresTableProps) {
	const [sorting, setSorting] = React.useState<SortingState>([{ id: '#', desc: true }])

	const rankById = React.useMemo(() => {
		const map = new Map<string, number>()
		const ranked = rows.toSorted((a, b) => (b.composite ?? -Infinity) - (a.composite ?? -Infinity))
		for (const [index, row] of ranked.entries()) map.set(row.marketMakerId, index + 1)
		return map
	}, [rows])

	const tableColumns = React.useMemo(() => buildPerformanceColumns({ onSelectMM, rankById }), [onSelectMM, rankById])

	const instance = useTable({
		features: sortedTableFeatures,
		data: rows,
		columns: tableColumns,
		state: { sorting },
		enableSortingRemoval: false,
		onSortingChange: setSorting
	})

	return <StickyTable table={instance} />
}
