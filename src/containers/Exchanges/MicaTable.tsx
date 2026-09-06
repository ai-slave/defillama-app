import type { VisibilityState } from '@tanstack/react-table'
import { useRouter } from 'next/router'
import * as React from 'react'
import { TableWithSearch } from '~/components/Table/TableWithSearch'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { pushShallowQuery } from '~/utils/routerQuery'
import { supportsMicaProduct } from './MicaCells'
import { MICA_COLUMNS, PINNED_MICA_EXCHANGE } from './micaColumns'
import type { MicaVenueModel, MicaVenueRowModel } from './models'
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

/** Contractual placement: Bybit EU leads the table; every other row keeps the
 *  backend's curated registry order. Filtering and placement share one pass. */
export function prepareMicaVenues<T extends MicaVenueModel>(rows: Array<T>, filter: MicaFilter): Array<T> {
	let pinned: T | null = null
	const visible: Array<T> = []

	for (const row of rows) {
		if (filter === 'fiat' && !row.fiatOnramp) continue
		if (filter !== 'all' && filter !== 'fiat' && !supportsMicaProduct(row, filter)) continue

		if (row.exchange === PINNED_MICA_EXCHANGE) pinned = row
		else visible.push(row)
	}

	if (pinned) visible.unshift(pinned)
	return visible
}

export function MicaTable({ venues }: { venues: Array<MicaVenueRowModel> }) {
	const router = useRouter()
	const filter = getMicaFilter(router.query)

	// TanStack derives table models from reference identity, so keep both inputs stable across unrelated control renders.
	const rows = React.useMemo(() => prepareMicaVenues(venues, filter), [filter, venues])

	return (
		<TableWithSearch
			key={filter}
			data={rows}
			columns={MICA_COLUMNS}
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
