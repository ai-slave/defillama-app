import { type ColumnVisibilityState, type ExpandedState, type SortingState, useTable } from '@tanstack/react-table'
import { matchSorter } from 'match-sorter'
import { startTransition, useMemo, useState } from 'react'
import type { IRWAFlowSummaryResponse, RWAOverviewDisplayRow } from '../api.types'
import type { RWAChangePeriod } from './change'
import type { RWAFlowStatus } from './columns/flows'
import {
	getRwaDefaultColumnVisibility,
	getRwaDefaultSorting,
	getRwaTableColumns,
	getRwaGroupingHiddenColumnIds,
	RWA_EXPANDED_COLUMN_IDS,
	RWA_TABLE_PRESETS,
	type RWATableColumn,
	type RWATablePreset
} from './columnSets'
import { rwaTableFeatures } from './features'
import type { RWAGroupBy, RWAPlatformLogos, RWATableView } from './groupBy'
import { groupRwaRows } from './grouping'
import { buildRwaLeafRows, getRwaTableSubRows, type RWALeafRow, type RWATableRow } from './rows'

export type RWATableInput = {
	assets: Array<RWAOverviewDisplayRow>
	view: RWATableView
	groupBy: RWAGroupBy
	search: string
	flowSummary: IRWAFlowSummaryResponse | undefined
	flowStatus: RWAFlowStatus
	period: RWAChangePeriod
	includeBridgeTvl: boolean
	includeCex: boolean
	platformLogos: RWAPlatformLogos
	preset: RWATablePreset
}

const SEARCH_KEYS = ['asset.assetName', 'asset.ticker', 'asset.parentPlatform']

export function searchRwaLeafRows(rows: Array<RWALeafRow>, search: string): Array<RWALeafRow> {
	if (!search) return rows
	return matchSorter(rows, search, { keys: SEARCH_KEYS, threshold: matchSorter.rankings.CONTAINS })
}

/** Search runs on leaf rows, before grouping. */
export function useRwaTable({
	assets,
	view,
	groupBy,
	search,
	flowSummary,
	flowStatus,
	period,
	includeBridgeTvl,
	includeCex,
	platformLogos,
	preset
}: RWATableInput) {
	const kind = view === 'perps' ? 'perps' : 'spot'
	// The period rides on the rows, so a period switch builds new rows and the table's cell cache starts over.
	const leafRows = useMemo(
		() =>
			buildRwaLeafRows(
				assets.filter((asset) => asset.kind === kind),
				{ flowSummary, includeBridgeTvl, period }
			),
		[assets, kind, flowSummary, includeBridgeTvl, period]
	)
	const rows = useMemo<Array<RWATableRow>>(
		() => [...groupRwaRows(searchRwaLeafRows(leafRows, search), groupBy, { platformLogos })],
		[leafRows, search, groupBy, platformLogos]
	)
	const columns = useMemo(
		() => getRwaTableColumns(view, flowStatus, period, { includeCex, preset }),
		[view, flowStatus, period, includeCex, preset]
	)

	const [sorting, setSorting] = useState<SortingState>(() => getRwaDefaultSorting(view))
	// Expansion belongs to the grouping it was opened in; a switch starts collapsed.
	const [expandedIn, setExpandedIn] = useState<{ groupBy: RWAGroupBy; expanded: ExpandedState }>({
		groupBy,
		expanded: {}
	})
	const expanded: ExpandedState = expandedIn.groupBy === groupBy ? expandedIn.expanded : {}
	const setExpanded = (updater: ExpandedState | ((previous: ExpandedState) => ExpandedState)) =>
		setExpandedIn((previous) => {
			const base = previous.groupBy === groupBy ? previous.expanded : {}
			return { groupBy, expanded: typeof updater === 'function' ? updater(base) : updater }
		})
	const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>(() =>
		getRwaDefaultColumnVisibility(view, columns, preset)
	)
	const [expandedColumnsChosenByReader, setExpandedColumnsChosenByReader] = useState(false)
	const effectiveVisibility = getRwaEffectiveColumnVisibility({
		columnVisibility,
		columns,
		preset,
		groupBy,
		expanded,
		expandedColumnsChosenByReader
	})

	const instance = useTable({
		features: rwaTableFeatures,
		data: rows,
		columns,
		state: { sorting, expanded, columnVisibility: effectiveVisibility },
		defaultColumn: { sortUndefined: 'last' },
		enableSortingRemoval: false,
		// Stable row ids keep open groups open across period and filter changes.
		autoResetExpanded: false,
		getRowId: (row) => row.id,
		getSubRows: getRwaTableSubRows,
		onSortingChange: (updater) => startTransition(() => setSorting(updater)),
		onExpandedChange: (updater) => startTransition(() => setExpanded(updater)),
		onColumnVisibilityChange: (updater) =>
			startTransition(() => {
				setColumnVisibility((previous) => {
					const next = typeof updater === 'function' ? updater(previous) : updater
					if (RWA_EXPANDED_COLUMN_IDS.some((id) => id in next && next[id] !== effectiveVisibility[id])) {
						setExpandedColumnsChosenByReader(true)
					}
					return next
				})
			})
	})

	return { instance, columns, columnVisibility: effectiveVisibility, rowCount: rows.length }
}

/**
 * Expand-only columns show while a group is open (always under Group by None) until the reader picks them;
 * a column the grouping makes redundant stays off.
 */
export function getRwaEffectiveColumnVisibility({
	columnVisibility,
	columns,
	preset,
	groupBy,
	expanded,
	expandedColumnsChosenByReader
}: {
	columnVisibility: ColumnVisibilityState
	columns: Array<RWATableColumn>
	preset: RWATablePreset
	groupBy: RWAGroupBy
	expanded: ExpandedState
	expandedColumnsChosenByReader: boolean
}): ColumnVisibilityState {
	const isAnyExpanded = groupBy === 'none' || expanded === true || Object.values(expanded).some(Boolean)
	return {
		...columnVisibility,
		...(expandedColumnsChosenByReader || !RWA_TABLE_PRESETS[preset].paintsExpandOnly
			? {}
			: expandedVisibility(columns, isAnyExpanded)),
		...Object.fromEntries(getRwaGroupingHiddenColumnIds(groupBy).map((id) => [id, false]))
	}
}

function expandedVisibility(columns: Array<RWATableColumn>, visible: boolean): ColumnVisibilityState {
	const present = new Set(
		columns.flatMap((column) => ('columns' in column && column.columns ? column.columns : [column])).map((c) => c.id)
	)
	const visibility: ColumnVisibilityState = {}
	for (const id of RWA_EXPANDED_COLUMN_IDS) if (present.has(id)) visibility[id] = visible
	return visibility
}
