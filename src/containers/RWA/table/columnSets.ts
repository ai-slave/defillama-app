import type { ColumnDef, SortingState } from '@tanstack/react-table'
import type { RWAChangePeriod } from './change'
import { chainsColumn } from './columns/chains'
import { createDefiColumnGroup } from './columns/defi'
import {
	assetDetailColumns,
	assetTypeColumn,
	complianceDetailColumns,
	complianceHiddenDetailColumns,
	perpsDetailColumns,
	suspiciousCsvColumns
} from './columns/details'
import { flagColumns, pickerFlagColumns } from './columns/flags'
import { createFlowsColumnGroup, type RWAFlowStatus } from './columns/flows'
import { createMarketcapColumnGroup } from './columns/marketcap'
import { nameColumn } from './columns/name'
import { perpsDefaultColumns, perpsExtraColumns, venueColumn } from './columns/perps'
import { perpsPricingColumnGroup, priceColumn } from './columns/pricing'
import type { RwaTableFeatures } from './features'
import type { RWAGroupBy, RWATableView } from './groupBy'
import type { RWATableRow } from './rows'

export type RWATableColumn = ColumnDef<RwaTableFeatures, RWATableRow, any>
export type RWAColumnOption = { key: string; name: string; help?: string }

export const RWA_DEFAULT_COLUMN_IDS: Record<RWATableView, ReadonlyArray<string>> = {
	assets: [
		'name',
		'chains',
		'assetGroup',
		'activeMcap',
		'onChainMcap',
		'activeMcapChange',
		'defiActiveTvl',
		'utilization',
		'defiActiveTvlChange',
		'netFlow'
	],
	perps: ['name', 'venue', 'assetGroup', 'openInterest', 'volume24h', 'volume30d', 'fundingApr', 'premium']
}

/** A column set over the same rows: Assets is the money, Compliance the detail columns a platform page shows. */
export type RWATablePreset = 'assets' | 'compliance'

/** What a preset settles besides its columns: the table's title, its csv name, whether the expand-only columns paint. */
export const RWA_TABLE_PRESETS: Record<
	RWATablePreset,
	{ title: string; csvName: string | null; paintsExpandOnly: boolean }
> = {
	assets: { title: 'Assets Rankings', csvName: null, paintsExpandOnly: true },
	compliance: { title: 'Compliance', csvName: 'compliance', paintsExpandOnly: false }
}

/** The Compliance preset's painted ids, in table order, read from the columns so the two cannot drift. */
export const RWA_COMPLIANCE_COLUMN_IDS: ReadonlyArray<string> = [
	nameColumn,
	...complianceDetailColumns,
	...pickerFlagColumns
].map((column) => {
	if (!column.id) throw new Error('RWA compliance column is missing an id')
	return column.id
})

/** Asset-row columns: shown while a group is open, until the reader picks them. */
export const RWA_EXPANDED_COLUMN_IDS = ['assetGroup', 'price', 'priceChange24h'] as const

/** Columns the grouping makes redundant. */
export function getRwaGroupingHiddenColumnIds(groupBy: RWAGroupBy): ReadonlyArray<string> {
	switch (groupBy) {
		case 'chain':
			return ['chains']
		case 'platform':
			return ['platform']
		default:
			return []
	}
}

export type RWATableColumnOptions = {
	/** Without CEX venues every row is a DEX. */
	includeCex?: boolean
	preset?: RWATablePreset
}

export function getRwaTableColumns(
	view: RWATableView,
	flowStatus: RWAFlowStatus,
	period: RWAChangePeriod,
	options: RWATableColumnOptions = {}
): Array<RWATableColumn> {
	if (view === 'perps') {
		return [
			nameColumn,
			...(options.includeCex ? [venueColumn] : []),
			assetTypeColumn,
			...perpsDefaultColumns,
			perpsPricingColumnGroup,
			...perpsExtraColumns,
			...perpsDetailColumns,
			...suspiciousCsvColumns
		]
	}
	if (options.preset === 'compliance') {
		return [
			nameColumn,
			...complianceDetailColumns,
			...pickerFlagColumns,
			chainsColumn,
			assetTypeColumn,
			createMarketcapColumnGroup(period),
			createDefiColumnGroup(period),
			createFlowsColumnGroup(flowStatus, period),
			priceColumn,
			...complianceHiddenDetailColumns,
			...suspiciousCsvColumns
		]
	}
	return [
		nameColumn,
		chainsColumn,
		assetTypeColumn,
		createMarketcapColumnGroup(period),
		createDefiColumnGroup(period),
		createFlowsColumnGroup(flowStatus, period),
		priceColumn,
		...assetDetailColumns,
		...flagColumns,
		...suspiciousCsvColumns
	]
}

export function getRwaDefaultSorting(view: RWATableView): SortingState {
	return [{ id: view === 'perps' ? 'openInterest' : 'activeMcap', desc: true }]
}

export function getRwaDefaultColumnVisibility(
	view: RWATableView,
	columns: Array<RWATableColumn>,
	preset: RWATablePreset = 'assets'
): Record<string, boolean> {
	const defaults = new Set(preset === 'compliance' ? RWA_COMPLIANCE_COLUMN_IDS : RWA_DEFAULT_COLUMN_IDS[view])
	const visibility: Record<string, boolean> = {}
	for (const leaf of leafColumns(columns)) {
		visibility[leaf.id] = Boolean(leaf.meta?.csvOnly) || defaults.has(leaf.id)
	}
	return visibility
}

/** Picker entries in table order, header group as a prefix; grouping-hidden columns left out. */
export function getRwaColumnOptions(
	columns: Array<RWATableColumn>,
	groupBy: RWAGroupBy = 'none'
): Array<RWAColumnOption> {
	const options: Array<RWAColumnOption> = []
	const hidden = new Set(getRwaGroupingHiddenColumnIds(groupBy))
	for (const column of columns) {
		const groupName = 'columns' in column && column.columns ? headerText(column) : null
		for (const leaf of 'columns' in column && column.columns ? column.columns : [column]) {
			if (leaf.meta?.hidden || (leaf.id && hidden.has(leaf.id))) continue
			const key = leaf.id
			if (!key) throw new Error('RWA table column is missing an id')
			const help = leaf.meta?.headerHelperText
			options.push({
				key,
				name: groupName ? `${groupName}: ${headerText(leaf)}` : headerText(leaf),
				...(help ? { help } : {})
			})
		}
	}
	return options
}

/** The painted columns the picker shows as selected: visible under `visibility` and not hidden by design. */
export function getRwaSelectedColumnIds(
	columns: Array<RWATableColumn>,
	visibility: Record<string, boolean>
): Array<string> {
	return leafColumns(columns)
		.filter((leaf) => visibility[leaf.id] !== false && !leaf.meta?.hidden)
		.map((leaf) => leaf.id)
}

/** The visibility a picker selection means: csv-only columns stay visible so the export keeps them. */
export function getRwaColumnVisibilityForSelection(
	columns: Array<RWATableColumn>,
	selected: ReadonlySet<string>
): Record<string, boolean> {
	const visibility: Record<string, boolean> = {}
	for (const leaf of leafColumns(columns)) visibility[leaf.id] = Boolean(leaf.meta?.csvOnly) || selected.has(leaf.id)
	return visibility
}

function leafColumns(columns: Array<RWATableColumn>): Array<RWATableColumn & { id: string }> {
	const leaves: Array<RWATableColumn & { id: string }> = []
	for (const column of columns) {
		for (const leaf of 'columns' in column && column.columns ? column.columns : [column]) {
			if (!leaf.id) throw new Error('RWA table column is missing an id')
			leaves.push(leaf as RWATableColumn & { id: string })
		}
	}
	return leaves
}

function headerText(column: RWATableColumn): string {
	return typeof column.header === 'string' ? column.header : (column.id ?? '')
}
