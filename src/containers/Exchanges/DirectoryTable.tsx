import type { ColumnVisibilityState, SortingState } from '@tanstack/react-table'
import { useRouter } from 'next/router'
import * as React from 'react'
import { SearchTableProvider } from '~/components/Table/search/SearchTableProvider'
import { TableColumnSelect } from '~/components/Table/search/TableColumnSelect'
import { TableCsvExport } from '~/components/Table/search/TableCsvExport'
import { TableSearchInput } from '~/components/Table/search/TableSearchInput'
import { VirtualSearchTableView } from '~/components/Table/search/VirtualSearchTableView'
import { Card } from '~/ui/Card'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { SelectWithCombobox } from '~/ui/SelectWithCombobox'
import { TableToolbar, TableToolbarControlGroup } from '~/ui/Toolbar'
import { pushShallowQuery } from '~/utils/routerQuery'
import { buildDirectoryColumns } from './directoryColumns'
import { ExchangeCountrySelect } from './ExchangeCountrySelect'
import type { MasterExchangeRegionCatalogResponse } from './master.types'
import { filterDirectoryRows, nestDirectoryRows, type DirectoryKind, type DirectoryTreeRow } from './modelHelpers'
import type { ExchangeDirectoryRowModel } from './models'
import {
	DEFAULT_DIRECTORY_QUERY_STATE,
	EXCHANGES_QUERY_KEYS,
	getDirectoryQueryState,
	segmentQueryValue,
	type DirectoryColumnGroup,
	type DirectoryScope
} from './queryState'
import { segmentToggle } from './segmentPresentation'

const KIND_OPTIONS = [
	{ key: 'all', name: 'All' },
	{ key: 'cex', name: 'CEX' },
	{ key: 'dex', name: 'DEX' }
] as const

const SCOPE_OPTIONS = [
	{ value: 'all', label: 'All', ariaLabel: 'All segments' },
	{ value: 'spot', ariaLabel: 'Spot', ...segmentToggle('spot') },
	{ value: 'linear_perp', ariaLabel: 'USD Perps', ...segmentToggle('linear_perp') },
	{ value: 'inverse_perp', ariaLabel: 'COIN Perps', ...segmentToggle('inverse_perp') }
] as const

const GROUP_OPTIONS = [
	{ key: 'activity', name: 'Activity' },
	{ key: 'transparency', name: 'Transparency' },
	{ key: 'fees', name: 'Fees' },
	{ key: 'funding', name: 'Funding' },
	{ key: 'compliance', name: 'Compliance' }
] as const

const GROUP_COLUMN_IDS: Record<DirectoryColumnGroup, Array<string>> = {
	// Render order lives in buildDirectoryColumns; this is only the visible set.
	// Active liquidity replaces the fixed ±2% depth here — same fact, band scaled to
	// the day's volatility. depth2Usd stays available through the column selector.
	// The segment-qualified twins sit alongside; scope visibility picks which set
	// applies, so no scope ever renders both.
	activity: [
		'spotSlippage',
		'perpSlippage',
		'spotMarkout',
		'perpMarkout',
		'intraSpread',
		'segmentActiveLiquidity',
		'perpOpenInterest',
		'spotNormalizedVolume',
		'perpNormalizedVolume',
		'activeLiquidity',
		'depth2Usd',
		'volume24h',
		'volumeChange24h',
		'openInterestUsd',
		'openInterestChange24h',
		'execCostToTrade',
		'execSlippage10k',
		'execMarkout1m',
		'normalizedVolume',
		'volumeToOi',
		'volumeToDepth',
		'sparkline',
		'marketCount',
		'coinCount',
		'spotFee',
		'linearPerpFee',
		'inversePerpFee'
	],
	transparency: [
		'reservesUsd',
		'cleanRatio',
		'inflows24hUsd',
		'inflows7dUsd',
		'inflows1mUsd',
		'ownTokenFraction',
		'auditor',
		'freshness',
		'warnings',
		'reservesSource'
	],
	fees: ['spotFee', 'linearPerpFee', 'inversePerpFee', 'feeToken'],
	funding: ['fiatCurrencies', 'fiatFees', 'fiatOnramp', 'rampCost', 'offRampCost'],
	compliance: ['headquarters', 'euStatus', 'mica', 'kyc']
}

const OPTIONAL_COLUMN_IDS = ['licenseCount', 'founded']
const ALL_COLUMN_IDS = [
	'kind',
	'venueLinks',
	...new Set([...Object.values(GROUP_COLUMN_IDS).flat(), ...OPTIONAL_COLUMN_IDS])
]

// Columns that only make sense in the merged `all` view: each names its own segment,
// which would be redundant-at-best and contradictory-at-worst inside a scope that has
// already fixed the segment.
const MERGED_ONLY_COLUMN_IDS = [
	'spotSlippage',
	'perpSlippage',
	'spotMarkout',
	'perpMarkout',
	'segmentActiveLiquidity',
	'perpOpenInterest',
	'spotNormalizedVolume',
	'perpNormalizedVolume'
]

// Fee columns follow the active segment scope exactly; perp-only metrics don't apply to
// spot. Execution columns read the scope's own segment, so every scope shows them; the
// merged view uses its per-segment twins instead. Active liquidity needs a
// normalized-volume band, which exists for spot and USD perps, so COIN perps show the
// fixed ±2% depth instead of a column of dashes.
const SCOPE_HIDDEN_COLUMN_IDS: Record<DirectoryScope, Array<string>> = {
	// The merged view drops every scope-bound column (they have no segment to read)
	// and every COIN-perp column: that segment is out of scope here by design.
	all: [
		'venueLinks',
		'kind',
		'spotFee',
		'linearPerpFee',
		'inversePerpFee',
		'activeLiquidity',
		'depth2Usd',
		'volume24h',
		'volumeChange24h',
		'openInterestUsd',
		'openInterestChange24h',
		'normalizedVolume',
		'volumeToOi',
		'volumeToDepth',
		'sparkline',
		'marketCount',
		'coinCount',
		'execSlippage10k',
		'execMarkout1m'
	],
	spot: [
		'openInterestUsd',
		'openInterestChange24h',
		'volumeToOi',
		'linearPerpFee',
		'inversePerpFee',
		'depth2Usd',
		...MERGED_ONLY_COLUMN_IDS
	],
	linear_perp: ['spotFee', 'inversePerpFee', 'depth2Usd', ...MERGED_ONLY_COLUMN_IDS],
	inverse_perp: ['spotFee', 'linearPerpFee', 'activeLiquidity', ...MERGED_ONLY_COLUMN_IDS]
}

export function directoryColumnVisibility(group: DirectoryColumnGroup, scope: DirectoryScope): ColumnVisibilityState {
	// The merged view hides fee columns so the metric views spend their width on
	// measurements, but the Fees view IS those columns: apply the hidden list as-is
	// there and the view renders only Name and Fee Token. Fees are per-segment, not
	// scope-bound (they read row.fees), so the spot and USD-perp fees can show; the
	// COIN-perp fee stays out with the rest of that segment.
	const hidden =
		scope === 'all' && group === 'fees'
			? SCOPE_HIDDEN_COLUMN_IDS.all.filter((id) => id !== 'spotFee' && id !== 'linearPerpFee')
			: SCOPE_HIDDEN_COLUMN_IDS[scope]
	const groupColumns = GROUP_COLUMN_IDS[group].filter((id) => !hidden.includes(id))
	// name always shows; links and type are dropped in the merged view (see its hidden
	// list), so they are only force-added for the exact-segment tables.
	const visible = new Set(scope === 'all' ? ['name', ...groupColumns] : ['name', 'venueLinks', 'kind', ...groupColumns])
	return Object.fromEntries(ALL_COLUMN_IDS.map((id) => [id, visible.has(id)]))
}

// The rows arrive pre-sorted by the measured quality ranking (see byQualityRank in
// master.mappers) and the rank is explained on screen by the tier chip before each
// name plus the row index. Transparency is the one view that ranks on its own figure
// (reserves). Clicking any header takes over.
function sortingFor(group: DirectoryColumnGroup): SortingState {
	return group === 'transparency' ? [{ id: 'reservesUsd', desc: true }] : []
}

/**
 * Both memos live in hooks so the compiler preserves them: in the component body the route-derived `kind`
 * and `scope` carry a mutable range it cannot see past, and it drops the memos instead, which would hand
 * TanStack a new model on every unrelated render. Parameters carry no such range.
 */
function useFilteredDirectoryRows(
	rows: Array<ExchangeDirectoryRowModel>,
	kind: DirectoryKind,
	scope: DirectoryScope,
	country: string | null,
	catalog: Parameters<typeof filterDirectoryRows>[1]['catalog']
) {
	return React.useMemo(
		() => nestDirectoryRows(filterDirectoryRows(rows, { kind, scope, country, catalog })),
		[rows, kind, scope, country, catalog]
	)
}

function useDirectoryColumns(scope: DirectoryScope, executionAvailable: Parameters<typeof buildDirectoryColumns>[1]) {
	return React.useMemo(() => buildDirectoryColumns(scope, executionAvailable), [scope, executionAvailable])
}

export function DirectoryTable({
	rows,
	country,
	catalog,
	catalogFailed,
	executionAvailable,
	onCountryChange
}: {
	rows: Array<ExchangeDirectoryRowModel>
	country: string | null
	catalog: MasterExchangeRegionCatalogResponse | null
	catalogFailed: boolean
	executionAvailable: boolean
	onCountryChange: (country: string | null) => void
}) {
	const router = useRouter()
	const { kind, scope, group } = getDirectoryQueryState(router.query)

	// TanStack derives table models from reference identity, so keep both inputs stable across unrelated control renders.
	// Venues whose parent entity is itself listed render as child rows nested under the parent.
	const filteredRows = useFilteredDirectoryRows(rows, kind, scope, country, catalog)
	// Brand rows start collapsed in the merged view: it is the default landing table and
	// every expanded parent pushes the ranked list further down. The exact-segment
	// tables keep their expanded default.
	const brandRowsExpanded = scope === 'all' ? undefined : true
	const columns = useDirectoryColumns(scope, executionAvailable)

	return (
		<SearchTableProvider<DirectoryTreeRow>
			key={`${scope}-${group}`}
			options={{
				data: filteredRows,
				columns,
				initialState: {
					sorting: sortingFor(group),
					columnVisibility: directoryColumnVisibility(group, scope),
					expanded: brandRowsExpanded
				},
				getSubRows: (row) => row.subRows
			}}
		>
			<Card padding="none">
				<TableToolbar>
					<TableToolbarControlGroup className="mr-auto">
						<SegmentedControl<DirectoryScope>
							value={scope}
							onValueChange={(nextScope) => {
								void pushShallowQuery(router, {
									[EXCHANGES_QUERY_KEYS.directoryScope]:
										nextScope === DEFAULT_DIRECTORY_QUERY_STATE.scope ? undefined : segmentQueryValue(nextScope)
								})
							}}
							options={SCOPE_OPTIONS}
							label="Market scope"
							variant="default"
							size="md"
						/>
						<SelectWithCombobox
							allValues={KIND_OPTIONS}
							selectedValues={[kind]}
							setSelectedValues={(values) => {
								const nextKind = values[0] as DirectoryKind | undefined
								if (!nextKind) return
								void pushShallowQuery(router, {
									[EXCHANGES_QUERY_KEYS.directoryKind]:
										nextKind === DEFAULT_DIRECTORY_QUERY_STATE.kind ? undefined : nextKind
								})
							}}
							label="Venue"
							singleSelect
							labelType="regular"
							variant="filter"
							size="md"
						/>
						<ExchangeCountrySelect
							catalog={catalog}
							catalogFailed={catalogFailed}
							selectedCountry={country}
							onCountryChange={onCountryChange}
						/>
						<SelectWithCombobox
							allValues={GROUP_OPTIONS}
							selectedValues={[group]}
							setSelectedValues={(values) => {
								const nextGroup = values[0] as DirectoryColumnGroup | undefined
								if (!nextGroup) return
								void pushShallowQuery(router, {
									[EXCHANGES_QUERY_KEYS.directoryGroup]:
										nextGroup === DEFAULT_DIRECTORY_QUERY_STATE.group ? undefined : nextGroup
								})
							}}
							label="View"
							singleSelect
							labelType="regular"
							variant="filter"
							size="md"
						/>
					</TableToolbarControlGroup>
					<TableSearchInput columnId="name" placeholder="Search exchanges…" width="inline" />
					<TableColumnSelect />
					<TableCsvExport filename="exchanges-directory" includeHiddenColumns />
				</TableToolbar>
				<VirtualSearchTableView rowSize={56} tableLayout="fixed" />
			</Card>
		</SearchTableProvider>
	)
}
