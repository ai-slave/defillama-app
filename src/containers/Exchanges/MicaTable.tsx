import type { ColumnVisibilityState } from '@tanstack/react-table'
import { useRouter } from 'next/router'
import * as React from 'react'
import { SearchTableProvider } from '~/components/Table/search/SearchTableProvider'
import { SearchTableView } from '~/components/Table/search/SearchTableView'
import { TableColumnSelect } from '~/components/Table/search/TableColumnSelect'
import { TableCsvExport } from '~/components/Table/search/TableCsvExport'
import { TableSearchInput } from '~/components/Table/search/TableSearchInput'
import { Card } from '~/ui/Card'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { TableToolbar } from '~/ui/Toolbar'
import { pushShallowQuery } from '~/utils/routerQuery'
import { supportsMicaProduct } from './MicaCells'
import { MICA_COLUMNS, PINNED_MICA_EXCHANGE } from './micaColumns'
import type { MicaVenueModel, MicaVenueRowModel } from './models'
import { DEFAULT_MICA_FILTER, EXCHANGES_QUERY_KEYS, getMicaFilter, type MicaFilter } from './queryState'

const FILTER_OPTIONS = [
	{ value: 'all', label: 'All' },
	{ value: 'spot', label: 'Spot' },
	{ value: 'perp', label: 'USD Perps' },
	{ value: 'fiat', label: 'Fiat onramp' }
] as const

const MICA_COLUMN_VISIBILITY: Record<MicaFilter, ColumnVisibilityState> = {
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

function micaColumnVisibility(filter: MicaFilter): ColumnVisibilityState {
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
		<SearchTableProvider
			key={filter}
			options={{
				data: rows,
				columns: MICA_COLUMNS,
				initialState: {
					columnVisibility: micaColumnVisibility(filter), // Preserve the curated order (Bybit EU first) until the user sorts.
					sorting: []
				}
			}}
		>
			<Card padding="none">
				<TableToolbar>
					<div className="mr-auto flex items-center overflow-x-auto">
						<SegmentedControl<MicaFilter>
							value={filter}
							onValueChange={(nextFilter) => {
								void pushShallowQuery(router, {
									[EXCHANGES_QUERY_KEYS.micaFilter]: nextFilter === DEFAULT_MICA_FILTER ? undefined : nextFilter
								})
							}}
							options={FILTER_OPTIONS}
							label="Exchange product"
							variant="default"
							size="md"
						/>
					</div>
					<TableSearchInput columnId="name" placeholder="Search exchanges…" width="inline" />
					<TableColumnSelect />
					<TableCsvExport filename="mica-exchanges" includeHiddenColumns />
				</TableToolbar>
				<SearchTableView columnSizing="content" />
			</Card>
		</SearchTableProvider>
	)
}
