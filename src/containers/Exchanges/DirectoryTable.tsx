import { type SortingState, type VisibilityState } from '@tanstack/react-table'
import { useRouter } from 'next/router'
import * as React from 'react'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { TableWithSearch } from '~/components/Table/TableWithSearch'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { pushShallowQuery } from '~/utils/routerQuery'
import { buildDirectoryColumns } from './directoryColumns'
import { ExchangeCountrySelect } from './ExchangeCountrySelect'
import type { MasterExchangeRegionCatalogResponse } from './master.types'
import { filterDirectoryRows, nestDirectoryRows, type DirectoryKind } from './modelHelpers'
import type { ExchangeDirectoryRowModel, ExchangeSegment } from './models'
import {
	DEFAULT_DIRECTORY_QUERY_STATE,
	EXCHANGES_QUERY_KEYS,
	getDirectoryQueryState,
	type DirectoryColumnGroup
} from './queryState'
import { SegmentToggleLabel } from './segmentPresentation'

const KIND_OPTIONS = [
	{ value: 'all', label: 'All' },
	{ value: 'cex', label: 'CEX' },
	{ value: 'dex', label: 'DEX' }
] as const

const SCOPE_OPTIONS = [
	{ value: 'spot', label: <SegmentToggleLabel segment="spot" />, ariaLabel: 'Spot' },
	{ value: 'linear_perp', label: <SegmentToggleLabel segment="linear_perp" />, ariaLabel: 'Linear Perps' },
	{ value: 'inverse_perp', label: <SegmentToggleLabel segment="inverse_perp" />, ariaLabel: 'Inverse Perps' }
] as const

const GROUP_OPTIONS = [
	{ value: 'activity', label: 'Activity' },
	{ value: 'transparency', label: 'Transparency' },
	{ value: 'fees', label: 'Fees' },
	{ value: 'funding', label: 'Funding' },
	{ value: 'compliance', label: 'Compliance' }
] as const

const GROUP_COLUMN_IDS: Record<DirectoryColumnGroup, string[]> = {
	activity: [
		'volume24h',
		'volumeChange24h',
		'normalizedVolume',
		'openInterestUsd',
		'openInterestChange24h',
		'volumeToOi',
		'depth2Usd',
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
	funding: ['fiatCurrencies', 'fiatFees', 'fiatOnramp', 'rampCost'],
	compliance: ['headquarters', 'euStatus', 'mica', 'kyc']
}

const OPTIONAL_COLUMN_IDS = ['licenseCount', 'founded']
const ALL_COLUMN_IDS = ['kind', ...new Set([...Object.values(GROUP_COLUMN_IDS).flat(), ...OPTIONAL_COLUMN_IDS])]

// Fee columns follow the active segment scope exactly; perp-only metrics don't apply to spot.
const SCOPE_HIDDEN_COLUMN_IDS: Record<ExchangeSegment, string[]> = {
	spot: ['openInterestUsd', 'openInterestChange24h', 'volumeToOi', 'linearPerpFee', 'inversePerpFee'],
	linear_perp: ['spotFee', 'inversePerpFee'],
	inverse_perp: ['spotFee', 'linearPerpFee']
}

function directoryColumnVisibility(group: DirectoryColumnGroup, scope: ExchangeSegment): VisibilityState {
	const hidden = SCOPE_HIDDEN_COLUMN_IDS[scope]
	const groupColumns = GROUP_COLUMN_IDS[group].filter((id) => !hidden.includes(id))
	const visible = new Set(['name', ...groupColumns])
	return Object.fromEntries(ALL_COLUMN_IDS.map((id) => [id, visible.has(id)]))
}

function sortingFor(group: DirectoryColumnGroup): SortingState {
	if (group === 'transparency') return [{ id: 'reservesUsd', desc: true }]
	if (group === 'fees') return []
	if (group === 'funding') return [{ id: 'fiatOnramp', desc: true }]
	if (group === 'compliance') return []
	return [{ id: 'volume24h', desc: true }]
}

export function DirectoryTable({
	rows,
	country,
	catalog,
	catalogFailed,
	onCountryChange
}: {
	rows: ExchangeDirectoryRowModel[]
	country: string | null
	catalog: MasterExchangeRegionCatalogResponse | null
	catalogFailed: boolean
	onCountryChange: (country: string | null) => void
}) {
	const router = useRouter()
	const { kind, scope, group } = getDirectoryQueryState(router.query)

	// TanStack derives table models from reference identity, so keep both inputs stable across unrelated control renders.
	// Venues whose parent entity is itself listed render as child rows nested under the parent.
	const filteredRows = React.useMemo(
		() => nestDirectoryRows(filterDirectoryRows(rows, { kind, scope, country, catalog })),
		[rows, kind, scope, country, catalog]
	)
	const columns = React.useMemo(() => buildDirectoryColumns(scope), [scope])

	return (
		<TableWithSearch
			key={`${scope}-${group}`}
			data={filteredRows}
			columns={columns}
			columnToSearch="name"
			placeholder="Search exchanges..."
			header={null}
			leadingControls={
				<div className="flex flex-wrap items-center gap-2">
					<SegmentedControl<ExchangeSegment>
						value={scope}
						onValueChange={(nextScope) => {
							void pushShallowQuery(router, {
								[EXCHANGES_QUERY_KEYS.directoryScope]:
									nextScope === DEFAULT_DIRECTORY_QUERY_STATE.scope ? undefined : nextScope
							})
						}}
						options={SCOPE_OPTIONS}
						label="Market scope"
						variant="responsive"
						size="md"
					/>
					<SelectWithCombobox
						allValues={KIND_OPTIONS.map((option) => ({ key: option.value, name: option.label }))}
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
						variant="filter-responsive"
						size="md"
					/>
					<ExchangeCountrySelect
						catalog={catalog}
						catalogFailed={catalogFailed}
						selectedCountry={country}
						onCountryChange={onCountryChange}
					/>
					<SelectWithCombobox
						allValues={GROUP_OPTIONS.map((option) => ({ key: option.value, name: option.label }))}
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
						variant="filter-responsive"
						size="md"
					/>
				</div>
			}
			columnVisibility={directoryColumnVisibility(group, scope)}
			initialExpanded
			showColumnSelect
			csvExportAllColumns
			csvFileName="exchanges-directory"
			sortingState={sortingFor(group)}
			tableLayout="fixed"
			rowSize={56}
		/>
	)
}
