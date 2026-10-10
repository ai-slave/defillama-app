import { inRange, rangeQuickPicks, USD_QUICK_PICK_LADDER } from '~/components/Filters/quickPicks'
import type { RouteTableRow } from '~/containers/Yields/data/types'

function parseAvailableBound(value: string) {
	if (value === '') return null
	const numericValue = Number(value)
	return Number.isFinite(numericValue) ? numericValue : null
}

export function filterBorrowRoutes({
	rows,
	selectedChains,
	minAvailable,
	maxAvailable
}: {
	rows: Array<RouteTableRow>
	selectedChains: Array<string>
	minAvailable: string
	maxAvailable: string
}) {
	const minAvailableValue = parseAvailableBound(minAvailable)
	const maxAvailableValue = parseAvailableBound(maxAvailable)
	const chainSet = new Set(selectedChains)
	const filtered: Array<RouteTableRow> = []
	const availableValues: Array<number | null> = []
	// Deselect All keeps no routes.
	if (selectedChains.length > 0) {
		for (const row of rows) {
			const rowChain = row.chains[0]
			if (rowChain && !chainSet.has(rowChain)) continue
			const available = row.availableBorrowUsd ?? null
			// The chips count the routes the chain filter keeps, so applying one leaves its own chips in place.
			availableValues.push(available)
			if (inRange(available, minAvailableValue, maxAvailableValue)) filtered.push(row)
		}
	}
	return { rows: filtered, availableQuickPicks: rangeQuickPicks(USD_QUICK_PICK_LADDER, availableValues) }
}

/** A partial count means only the hydrated first page is loaded, so the total comes from the snapshot. */
export function formatBorrowRoutesSummary({
	shownCount,
	totalCount,
	isPartial
}: {
	shownCount: number
	totalCount: number
	isPartial: boolean
}) {
	if (shownCount === 0) return null
	if (isPartial) return `Showing ${shownCount} of ${totalCount} ${totalCount === 1 ? 'route' : 'routes'}`
	return `Tracking ${shownCount} ${shownCount === 1 ? 'route' : 'routes'}`
}
