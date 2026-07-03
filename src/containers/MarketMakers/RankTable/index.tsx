import { getCoreRowModel, getSortedRowModel, type SortingState, useReactTable } from '@tanstack/react-table'
import * as React from 'react'
import { LocalLoader } from '~/components/Loaders'
import { type ColumnConfig, type DisplayMode, type Threshold } from '../constants'
import { RefineButton } from '../RefineButton'
import { StickyTable } from '../StickyTable'
import type { LeaderboardRow } from '../types'
import { buildRankColumns } from './columns'
import { ShowAsControl } from './ShowAsControl'
import { ThresholdSelect } from './ThresholdSelect'

interface IRankTableProps {
	rows: LeaderboardRow[]
	columns: ColumnConfig[]
	mode: DisplayMode
	setMode: (mode: DisplayMode) => void
	threshold?: Threshold
	setThreshold?: (threshold: Threshold) => void
	onRefine: () => void
	onSelectMM: (marketMakerId: string, marketMakerName: string) => void
	isLoading?: boolean
}

export function RankTable({
	rows,
	columns,
	mode,
	setMode,
	threshold,
	setThreshold,
	onRefine,
	onSelectMM,
	isLoading
}: IRankTableProps) {
	'use no memo'
	const [sorting, setSorting] = React.useState<SortingState>([{ id: '#', desc: true }])

	const tableColumns = React.useMemo(
		() => buildRankColumns({ columns, mode, rowCount: rows.length, onSelectMM }),
		[columns, mode, rows.length, onSelectMM]
	)

	const instance = useReactTable({
		data: rows,
		columns: tableColumns,
		state: { sorting },
		enableSortingRemoval: false,
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel()
	})

	return (
		<div className="flex flex-col rounded-md border border-(--cards-border) bg-(--cards-bg)">
			<div className="flex flex-wrap items-center gap-2 border-b border-(--cards-border) p-4">
				<span className="text-base font-semibold">Rank</span>
				{threshold && setThreshold ? <ThresholdSelect value={threshold} setValue={setThreshold} /> : null}
				<div className="ml-auto flex flex-wrap items-center gap-2">
					<ShowAsControl mode={mode} setMode={setMode} />
					<RefineButton onClick={onRefine} />
				</div>
			</div>
			{isLoading ? (
				<div className="flex min-h-[240px] items-center justify-center p-8">
					<LocalLoader />
				</div>
			) : rows.length === 0 ? (
				<div className="flex min-h-[240px] flex-col items-center justify-center gap-3 p-8 text-center">
					<p className="text-(--text-secondary)">Your filter preferences did not provide any result</p>
					<button
						type="button"
						onClick={onRefine}
						className="rounded-md border border-(--form-control-border) px-3 py-1.5 text-xs font-medium text-(--text-form) hover:bg-(--link-hover-bg)"
					>
						Reset
					</button>
				</div>
			) : (
				<StickyTable headerGroups={instance.getHeaderGroups()} rows={instance.getRowModel().rows} />
			)}
		</div>
	)
}
