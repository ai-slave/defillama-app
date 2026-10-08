import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { getRwaPageLayout, type RWAPageKind, type RWASection } from '../layout/pageLayout'
import type { RWAChangePeriod } from './change'
import { chainsColumn } from './columns/chains'
import { createDefiColumnGroup } from './columns/defi'
import {
	assetDetailColumns,
	assetTypeColumn,
	complianceDetailColumns,
	complianceHiddenDetailColumns,
	suspiciousCsvColumns
} from './columns/details'
import { flagColumns, pickerFlagColumns } from './columns/flags'
import { createFlowsColumnGroup, type RWAFlowStatus } from './columns/flows'
import { createMarketcapColumnGroup } from './columns/marketcap'
import { nameColumn } from './columns/name'
import { perpsCsvColumns } from './columns/perps'
import { createPerpsColumns } from './columns/perpsMetrics'
import { priceColumn } from './columns/pricing'
import type { RWATableColumnSet } from './columnSetQuery'
import type { RwaTableFeatures } from './features'
import type { RWAGroupBy } from './groupBy'
import type { RWATableRow } from './rows'

export type RWATableColumn = ColumnDef<RwaTableFeatures, RWATableRow, any>
export type RWAColumnOption = { key: string; name: string; help?: string }

/** The Compliance set's painted ids, in table order, read from the columns so the two cannot drift. */
export const RWA_COMPLIANCE_COLUMN_IDS: ReadonlyArray<string> = [
	nameColumn,
	...complianceDetailColumns,
	...pickerFlagColumns
].map((column) => {
	if (!column.id) throw new Error('RWA compliance column is missing an id')
	return column.id
})

/** What a column set settles besides its columns, per row kind. */
type RWAColumnSetFacts = {
	/** The columns the set paints by default; the rest of the set waits in the picker. */
	defaults: ReadonlyArray<string>
	/** The part of the csv name; Metrics exports as the page's table. */
	csvPart: 'table' | 'compliance'
	/** The 1d, 7d, 1m switch drives the asset change columns; Compliance and perps rows have none. */
	periodSwitch: boolean
	/** The open-only columns paint while a group is open; Compliance paints its defaults. */
	paintsOpenOnly: boolean
}

const RWA_COLUMN_SETS = {
	assets: {
		metrics: {
			defaults: [
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
			csvPart: 'table',
			periodSwitch: true,
			paintsOpenOnly: true
		},
		compliance: {
			defaults: RWA_COMPLIANCE_COLUMN_IDS,
			csvPart: 'compliance',
			periodSwitch: false,
			paintsOpenOnly: false
		}
	},
	perps: {
		metrics: {
			defaults: [
				'name',
				'platform',
				'assetGroup',
				'openInterest',
				'openInterestChange24h',
				'volume24h',
				'volume7d',
				'volume30d',
				'protocolFees24h',
				'protocolFees30d',
				'accessModel'
			],
			csvPart: 'table',
			periodSwitch: false,
			paintsOpenOnly: true
		}
	}
} as const satisfies Record<RWASection, Partial<Record<RWATableColumnSet, RWAColumnSetFacts>>>

/** A set the row kind lacks reads as Metrics. */
export function getRwaColumnSet(section: RWASection, columnSet: RWATableColumnSet): RWAColumnSetFacts {
	const sets: Partial<Record<RWATableColumnSet, RWAColumnSetFacts>> = RWA_COLUMN_SETS[section]
	return sets[columnSet] ?? RWA_COLUMN_SETS[section].metrics
}

/**
 * Open-only columns per row kind: hidden while every group is closed, shown while one is open (always under Group by
 * None), until the reader picks them. A group row leaves them empty: a price or a funding rate does not mean one
 * thing for a venue or an asset group.
 */
export const RWA_EXPANDED_COLUMN_IDS = {
	assets: ['assetGroup', 'price', 'priceChange24h'],
	perps: ['pair', 'price', 'priceChange24h', 'premium', 'fundingApr', 'fundingInterval', 'maxLeverage']
} as const satisfies Record<RWASection, ReadonlyArray<string>>

/** A page never shows its own dimension: on one venue, one asset group or one asset these columns hold one value. */
const PAGE_OWN_COLUMN_IDS: Partial<Record<RWAPageKind, ReadonlyArray<string>>> = {
	venue: ['platform', 'venueType'],
	perpsAssetGroup: ['assetGroup'],
	perpsAsset: ['assetGroup', 'asset']
}

/** Columns the page or the grouping makes redundant; perps rows carry the venue in the platform column. */
export function getRwaHiddenColumnIds(groupBy: RWAGroupBy, pageKind: RWAPageKind): ReadonlyArray<string> {
	const hidden = [...(PAGE_OWN_COLUMN_IDS[pageKind] ?? [])]
	if (groupBy === 'chain') hidden.push('chains')
	if (groupBy === 'platform') hidden.push('platform')
	// A group row names its asset group under Group by Asset Group; perps rows keep the column under Venue and None only.
	const perps = getRwaPageLayout(pageKind).section === 'perps'
	if (perps ? groupBy !== 'platform' && groupBy !== 'none' : groupBy === 'assetGroup') hidden.push('assetGroup')
	return hidden
}

export function getRwaTableColumns(
	pageKind: RWAPageKind,
	flowStatus: RWAFlowStatus,
	period: RWAChangePeriod,
	columnSet: RWATableColumnSet
): Array<RWATableColumn> {
	if (getRwaPageLayout(pageKind).section === 'perps') {
		// The asset page names its asset, so its rows drop the asset line under the contract.
		const assetLine = !PAGE_OWN_COLUMN_IDS[pageKind]?.includes('asset')
		return [...createPerpsColumns({ assetLine }), ...perpsCsvColumns, ...suspiciousCsvColumns]
	}
	if (columnSet === 'compliance') {
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

export function getRwaDefaultSorting(section: RWASection): SortingState {
	return [{ id: section === 'perps' ? 'openInterest' : 'activeMcap', desc: true }]
}

export function getRwaDefaultColumnVisibility(
	section: RWASection,
	columns: Array<RWATableColumn>,
	columnSet: RWATableColumnSet
): Record<string, boolean> {
	const defaults = new Set(getRwaColumnSet(section, columnSet).defaults)
	const visibility: Record<string, boolean> = {}
	for (const leaf of leafColumns(columns)) {
		visibility[leaf.id] = Boolean(leaf.meta?.csvOnly) || defaults.has(leaf.id)
	}
	return visibility
}

/** Picker entries in table order, header group as a prefix; columns the page or the grouping hides left out. */
export function getRwaColumnOptions(
	columns: Array<RWATableColumn>,
	groupBy: RWAGroupBy,
	pageKind: RWAPageKind
): Array<RWAColumnOption> {
	const options: Array<RWAColumnOption> = []
	const names = new Set<string>()
	const hidden = new Set(getRwaHiddenColumnIds(groupBy, pageKind))
	for (const column of columns) {
		const groupName = 'columns' in column && column.columns ? headerText(column) : null
		for (const leaf of leafColumns([column])) {
			if (leaf.meta?.hidden || hidden.has(leaf.id)) continue
			const help = leaf.meta?.headerHelperText
			// Two leaves may share a short header ("24h" volume and its change); the second takes its export label.
			let name = groupName ? `${groupName}: ${headerText(leaf)}` : headerText(leaf)
			if (names.has(name) && leaf.meta?.csvHeader)
				name = groupName ? `${groupName}: ${leaf.meta.csvHeader}` : leaf.meta.csvHeader
			names.add(name)
			options.push({
				key: leaf.id,
				name,
				...(help ? { help } : {})
			})
		}
	}
	return options
}

export function leafColumns(columns: Array<RWATableColumn>): Array<RWATableColumn & { id: string }> {
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
