import { type SortingState, useTable } from '@tanstack/react-table'
import * as React from 'react'
import { sortedTableFeatures } from '~/components/Table/features/sorting'
import { Button } from '~/ui/Button'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { EmptyState, SurfaceBodyLoadingStatus } from '~/ui/Status'
import type { ColumnConfig, DisplayMode, Threshold } from '../constants'
import { RefineButton } from '../RefineButton'
import { StickyTable } from '../StickyTable'
import type { LeaderboardRow } from '../types'
import { buildRankColumns } from './columns'
import { ThresholdSelect } from './ThresholdSelect'

// How every metric cell reads: the raw value, its percentile, or its rank. Short labels keep it one row on phones.
const SHOW_AS_OPTIONS: ReadonlyArray<{ value: DisplayMode; label: string }> = [
	{ value: 'value', label: 'Value' },
	{ value: 'percentile', label: 'Percentile' },
	{ value: 'rank', label: 'Rank' }
]

interface IRankTableProps {
	rows: Array<LeaderboardRow>
	columns: Array<ColumnConfig>
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
	const [sorting, setSorting] = React.useState<SortingState>([{ id: '#', desc: true }])

	const tableColumns = React.useMemo(
		() => buildRankColumns({ columns, mode, rowCount: rows.length, onSelectMM }),
		[columns, mode, rows.length, onSelectMM]
	)

	const instance = useTable({
		features: sortedTableFeatures,
		data: rows,
		columns: tableColumns,
		state: { sorting },
		enableSortingRemoval: false,
		onSortingChange: setSorting
	})

	return (
		<Panel padding="none">
			<PanelHeader>
				<PanelTitle>Rank</PanelTitle>
				{threshold && setThreshold ? <ThresholdSelect value={threshold} setValue={setThreshold} /> : null}
				<div className="ml-auto flex flex-wrap items-center gap-1.5">
					{/* One control: Value, Percentile and Rank are three readings of the same cells, so they stay one switch. */}
					<SegmentedControl
						value={mode}
						onValueChange={setMode}
						options={SHOW_AS_OPTIONS}
						label="Show as"
						leading="Show as"
						variant="default"
						size="md"
					/>
					<RefineButton onClick={onRefine} />
				</div>
			</PanelHeader>
			{isLoading ? (
				<SurfaceBodyLoadingStatus label="Loading rankings" className="min-h-[240px]" />
			) : rows.length === 0 ? (
				<EmptyState
					size="md"
					title="No market makers match your filters"
					actions={
						<Button type="button" onClick={onRefine} size="sm">
							Reset
						</Button>
					}
					className="min-h-[240px]"
				/>
			) : (
				<StickyTable table={instance} />
			)}
		</Panel>
	)
}
