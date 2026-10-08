import { type ColumnVisibilityState, type ExpandedState, type SortingState, useTable } from '@tanstack/react-table'
import { matchSorter } from 'match-sorter'
import { startTransition, useMemo, useState } from 'react'
import type { IRWAFlowSummaryResponse, RWAOverviewDisplayRow } from '../api.types'
import { getRwaPageLayout, type RWAPageKind, type RWASection } from '../layout/pageLayout'
import type { RWAChangePeriod } from './change'
import type { RWAFlowStatus } from './columns/flows'
import type { RWATableColumnSet } from './columnSetQuery'
import {
	getRwaColumnSet,
	getRwaDefaultColumnVisibility,
	getRwaDefaultSorting,
	getRwaHiddenColumnIds,
	getRwaTableColumns,
	leafColumns,
	RWA_EXPANDED_COLUMN_IDS,
	type RWATableColumn
} from './columnSets'
import { rwaTableFeatures } from './features'
import type { RWAGroupBy, RWAPlatformLogos } from './groupBy'
import { groupRwaRows } from './grouping'
import { buildRwaLeafRows, getRwaTableSubRows, type RWALeafRow, type RWATableRow } from './rows'

type RWATableInput = {
	/** The page's rows, all of the kind its page kind shows. */
	assets: Array<RWAOverviewDisplayRow>
	groupBy: RWAGroupBy
	search: string
	flowSummary: IRWAFlowSummaryResponse | undefined
	flowStatus: RWAFlowStatus
	period: RWAChangePeriod
	includeBridgeTvl: boolean
	platformLogos?: RWAPlatformLogos
	columnSet: RWATableColumnSet
	pageKind: RWAPageKind
}

type RWAColumnPicks = {
	columnSet: RWATableColumnSet
	columnVisibility: ColumnVisibilityState
	/** The reader picked an open-only column, so the open rule stops driving them. */
	chosenByReader: boolean
}

function defaultPicks(
	section: RWASection,
	columns: Array<RWATableColumn>,
	columnSet: RWATableColumnSet
): RWAColumnPicks {
	return {
		columnSet,
		columnVisibility: getRwaDefaultColumnVisibility(section, columns, columnSet),
		chosenByReader: false
	}
}

const SEARCH_KEYS = ['asset.assetName', 'asset.ticker', 'asset.parentPlatform']

export function searchRwaLeafRows(rows: Array<RWALeafRow>, search: string): Array<RWALeafRow> {
	if (!search) return rows
	return matchSorter(rows, search, { keys: SEARCH_KEYS, threshold: matchSorter.rankings.CONTAINS })
}

/** Search runs on leaf rows, before grouping. */
export function useRwaTable({
	assets,
	groupBy,
	search,
	flowSummary,
	flowStatus,
	period,
	includeBridgeTvl,
	platformLogos,
	columnSet,
	pageKind
}: RWATableInput) {
	const { section } = getRwaPageLayout(pageKind)
	const columns = useMemo(
		() => getRwaTableColumns(pageKind, flowStatus, period, columnSet),
		[pageKind, flowStatus, period, columnSet]
	)

	const [sorting, setSorting] = useState<SortingState>(() => getRwaDefaultSorting(section))
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
	// Visibility and the reader's picks belong to the column set; a set switch starts from that set's defaults and
	// keeps the search, the sort and the open groups.
	const [pickedIn, setPickedIn] = useState<RWAColumnPicks>(() => defaultPicks(section, columns, columnSet))
	const picks = pickedIn.columnSet === columnSet ? pickedIn : defaultPicks(section, columns, columnSet)
	const { columnVisibility, chosenByReader: expandedColumnsChosenByReader } = picks
	const effectiveVisibility = getRwaEffectiveColumnVisibility({
		columnVisibility,
		columns,
		columnSet,
		groupBy,
		pageKind,
		expanded,
		expandedColumnsChosenByReader
	})

	// The period rides on the rows, so a period switch builds new rows and the table's cell cache starts over.
	const leafRows = useMemo(
		() => buildRwaLeafRows(assets, { flowSummary, includeBridgeTvl, period }),
		[assets, flowSummary, includeBridgeTvl, period]
	)
	const rows = useMemo<Array<RWATableRow>>(
		() => [...groupRwaRows(searchRwaLeafRows(leafRows, search), groupBy, { platformLogos })],
		[leafRows, search, groupBy, platformLogos]
	)
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
				setPickedIn((previous) => {
					const base = previous.columnSet === columnSet ? previous : defaultPicks(section, columns, columnSet)
					const next = typeof updater === 'function' ? updater(base.columnVisibility) : updater
					const chosenByReader =
						base.chosenByReader ||
						RWA_EXPANDED_COLUMN_IDS[section].some((id) => id in next && next[id] !== effectiveVisibility[id])
					return { columnSet, columnVisibility: next, chosenByReader }
				})
			})
	})

	return { instance, columns, columnVisibility: effectiveVisibility }
}

/**
 * Open-only columns show while a group is open (always under Group by None) until the reader picks them;
 * a column the page or the grouping makes redundant stays off.
 */
export function getRwaEffectiveColumnVisibility({
	columnVisibility,
	columns,
	columnSet,
	groupBy,
	pageKind,
	expanded,
	expandedColumnsChosenByReader
}: {
	columnVisibility: ColumnVisibilityState
	columns: Array<RWATableColumn>
	columnSet: RWATableColumnSet
	groupBy: RWAGroupBy
	pageKind: RWAPageKind
	expanded: ExpandedState
	expandedColumnsChosenByReader: boolean
}): ColumnVisibilityState {
	const { section } = getRwaPageLayout(pageKind)
	const isAnyExpanded = groupBy === 'none' || expanded === true || Object.values(expanded).some(Boolean)
	return {
		...columnVisibility,
		...(expandedColumnsChosenByReader || !getRwaColumnSet(section, columnSet).paintsOpenOnly
			? {}
			: expandedVisibility(columns, RWA_EXPANDED_COLUMN_IDS[section], isAnyExpanded)),
		...Object.fromEntries(getRwaHiddenColumnIds(groupBy, pageKind).map((id) => [id, false]))
	}
}

function expandedVisibility(
	columns: Array<RWATableColumn>,
	ids: ReadonlyArray<string>,
	visible: boolean
): ColumnVisibilityState {
	const present = new Set(leafColumns(columns).map((column) => column.id))
	const visibility: ColumnVisibilityState = {}
	for (const id of ids) if (present.has(id)) visibility[id] = visible
	return visibility
}
