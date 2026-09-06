import type { SortingState, VisibilityState } from '@tanstack/react-table'
import type { EquityActiveFilter } from './filters'

export function applyEquityFilterColumnVisibility({
	columnVisibility,
	filters
}: {
	columnVisibility: VisibilityState
	filters: Array<EquityActiveFilter>
}): VisibilityState {
	const effectiveVisibility: VisibilityState = { ...columnVisibility, searchPriority: false }
	for (const filter of filters) {
		effectiveVisibility[filter.id] = true
	}
	return effectiveVisibility
}

function getDefaultSortingFilter(filters: Array<EquityActiveFilter>): EquityActiveFilter | null {
	return filters.findLast((filter) => filter.kind !== 'categorical') ?? null
}

function isDefaultFilterSortDescending(filter: EquityActiveFilter): boolean {
	if (filter.kind !== 'numeric') return true
	return filter.operator !== '<' && filter.operator !== '<='
}

export function getEquityFilterDefaultSorting({
	filters,
	fallbackSorting
}: {
	filters: Array<EquityActiveFilter>
	fallbackSorting: SortingState
}): SortingState {
	const filter = getDefaultSortingFilter(filters)
	return filter ? [{ id: filter.id, desc: isDefaultFilterSortDescending(filter) }] : fallbackSorting
}

function isSortingEqual(left: SortingState, right: SortingState): boolean {
	if (left.length !== right.length) return false
	for (const [index, leftSort] of left.entries()) {
		const rightSort = right[index]
		if (!rightSort || leftSort.id !== rightSort.id || leftSort.desc !== rightSort.desc) return false
	}
	return true
}

export function shouldUpdateEquityFilterDefaultSorting({
	currentSorting,
	previousFilters,
	fallbackSorting
}: {
	currentSorting: SortingState
	previousFilters: Array<EquityActiveFilter>
	fallbackSorting: SortingState
}): boolean {
	return (
		isSortingEqual(currentSorting, fallbackSorting) ||
		isSortingEqual(currentSorting, getEquityFilterDefaultSorting({ filters: previousFilters, fallbackSorting }))
	)
}
