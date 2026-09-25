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

	return rows.filter((row) => {
		const rowChain = row.chains[0]
		const available = row.availableBorrowUsd ?? null

		if (selectedChains.length === 0) return false
		if (rowChain && !chainSet.has(rowChain)) return false
		if (minAvailableValue != null && (available == null || available < minAvailableValue)) return false
		if (maxAvailableValue != null && (available == null || available > maxAvailableValue)) return false

		return true
	})
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
