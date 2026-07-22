import type { VisibilityState } from '@tanstack/react-table'
import { useRouter } from 'next/router'
import * as React from 'react'
import { TableWithSearch } from '~/components/Table/TableWithSearch'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { pushShallowQuery } from '~/utils/routerQuery'
import { supportsMicaProduct } from './MicaCells'
import { buildMicaColumns, PINNED_MICA_EXCHANGE } from './micaColumns'
import type { MicaVenueModel } from './models'
import { DEFAULT_MICA_FILTER, EXCHANGES_QUERY_KEYS, getMicaFilter, type MicaFilter } from './queryState'

const FILTER_OPTIONS = [
	{ value: 'all', label: 'All' },
	{ value: 'spot', label: 'Spot' },
	{ value: 'perp', label: 'Perps' },
	{ value: 'fiat', label: 'Fiat onramp' }
] as const

const MICA_COLUMN_VISIBILITY: Record<MicaFilter, VisibilityState> = {
	all: { micaStatus: false, fiatOnramp: false },
	spot: {
		micaStatus: false,
		fiatOnramp: false,
		perpDepth2: false,
		perpDepth05: false,
		perpFee: false,
		onRampCost: false,
		offRampCost: false
	},
	perp: {
		micaStatus: false,
		fiatOnramp: false,
		spotDepth2: false,
		spotDepth05: false,
		spotFee: false,
		onRampCost: false,
		offRampCost: false
	},
	fiat: {
		micaStatus: false,
		fiatOnramp: false,
		spotDepth2: false,
		spotDepth05: false,
		perpDepth2: false,
		perpDepth05: false,
		spotFee: false,
		perpFee: false,
		marketCount: false
	}
}

export function micaColumnVisibility(filter: MicaFilter): VisibilityState {
	return MICA_COLUMN_VISIBILITY[filter]
}

export function filterMicaVenues(rows: MicaVenueModel[], filter: MicaFilter): MicaVenueModel[] {
	if (filter === 'all') return rows
	if (filter === 'fiat') return rows.filter((row) => row.fiatOnramp)
	return rows.filter((row) => supportsMicaProduct(row, filter))
}

/** Contractual placement: Bybit EU leads the table; every other row keeps the
 *  backend's curated registry order. Pure — returns a new array. */
export function orderMicaVenues(rows: MicaVenueModel[]): MicaVenueModel[] {
	return [...rows].sort(
		(a, b) => (a.exchange === PINNED_MICA_EXCHANGE ? 0 : 1) - (b.exchange === PINNED_MICA_EXCHANGE ? 0 : 1)
	)
}

export function MicaTable({ venues, asOfDate }: { venues: MicaVenueModel[]; asOfDate: string }) {
	const router = useRouter()
	const filter = getMicaFilter(router.query)

	// TanStack derives table models from reference identity, so keep both inputs stable across unrelated control renders.
	const rows = React.useMemo(() => orderMicaVenues(filterMicaVenues(venues, filter)), [filter, venues])
	const columns = React.useMemo(() => buildMicaColumns(asOfDate), [asOfDate])

	return (
		<TableWithSearch
			key={filter}
			data={rows}
			columns={columns}
			columnToSearch="name"
			placeholder="Search exchanges..."
			header={null}
			leadingControls={
				<SegmentedControl<MicaFilter>
					value={filter}
					onValueChange={(nextFilter) => {
						void pushShallowQuery(router, {
							[EXCHANGES_QUERY_KEYS.micaFilter]: nextFilter === DEFAULT_MICA_FILTER ? undefined : nextFilter
						})
					}}
					options={FILTER_OPTIONS}
					label="Exchange product"
					variant="responsive"
					size="md"
				/>
			}
			columnVisibility={micaColumnVisibility(filter)}
			showColumnSelect
			csvExportAllColumns
			// Open in the curated order (Bybit EU pinned first), not an active column
			// sort — users can still click any header to re-sort.
			sortingState={[]}
			csvFileName="mica-exchanges"
			skipVirtualization
			tableLayout="auto"
		/>
	)
}
