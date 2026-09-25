import { constructTable, type ExpandedState, flexRender, type Table } from '@tanstack/react-table'
import { storeReactivityBindings } from '@tanstack/table-core/store-reactivity-bindings'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { prepareTableCsv } from '~/components/Table/utils'
import {
	getRwaColumnOptions,
	getRwaDefaultColumnVisibility,
	getRwaTableColumns,
	RWA_COMPLIANCE_COLUMN_IDS,
	RWA_DEFAULT_COLUMN_IDS
} from '../columnSets'
import { getRwaCsvRows } from '../csv'
import { rwaTableFeatures, type RwaTableFeatures } from '../features'
import type { RWAGroupBy, RWATableView } from '../groupBy'
import { groupRwaRows } from '../grouping'
import { buildRwaLeafRows, type RWATableRow } from '../rows'
import { perpsAsset, spotAsset } from './fixtures'

type RwaTestTable = Table<RwaTableFeatures, RWATableRow>

/** A headless instance outside React needs a store for its state. */
const headlessFeatures = { ...rwaTableFeatures, coreReactivityFeature: storeReactivityBindings() }

function buildTable(view: RWATableView, groupBy: RWAGroupBy, expanded: ExpandedState = true): RwaTestTable {
	const kind = view === 'perps' ? 'perps' : 'spot'
	const assets = [spotAsset(), perpsAsset()].filter((asset) => asset.kind === kind)
	const columns = getRwaTableColumns(view, 'ready', '7d', { includeCex: true })
	return constructTable({
		features: headlessFeatures,
		data: groupRwaRows(buildRwaLeafRows(assets, { includeBridgeTvl: true }), groupBy),
		columns,
		getRowId: (row) => row.id,
		getSubRows: (row) => (row.kind === 'group' ? row.children : undefined),
		state: { expanded, columnVisibility: getRwaDefaultColumnVisibility(view, columns) }
	})
}

/** Visible columns the table paints; csv-only columns stay visible for the export but are never painted. */
function paintedColumnIds(table: RwaTestTable): Array<string> {
	return table
		.getVisibleLeafColumns()
		.filter((column) => !column.columnDef.meta?.hidden)
		.map((column) => column.id)
}

function cellMarkup(table: RwaTestTable, rowId: string, columnId: string): string {
	const row = table.getRowModel().rows.find((candidate) => candidate.id === rowId)
	if (!row) throw new Error(`row ${rowId} not found`)
	const cell = row.getAllCells().find((candidate) => candidate.column.id === columnId)
	if (!cell) throw new Error(`column ${columnId} not found`)
	return renderToStaticMarkup(flexRender(cell.column.columnDef.cell, cell.getContext()))
}

const cellText = (table: RwaTestTable, rowId: string, columnId: string) =>
	cellMarkup(table, rowId, columnId).replace(/<[^>]+>/g, '')

describe('RWA table column set', () => {
	test('paints the default columns and keeps csv-only columns out of the table and the picker', () => {
		const table = buildTable('assets', 'platform')
		expect(paintedColumnIds(table)).toEqual(RWA_DEFAULT_COLUMN_IDS.assets)
		const csvOnly = table
			.getAllLeafColumns()
			.filter((column) => column.columnDef.meta?.csvOnly)
			.map((column) => column.id)
		expect(csvOnly).toContain('kycForMintRedeem')
		const pickerKeys = getRwaColumnOptions(getRwaTableColumns('assets', 'ready', '7d')).map((option) => option.key)
		for (const id of csvOnly) expect(pickerKeys).not.toContain(id)
	})

	test('drops the column a grouping makes redundant from the picker', () => {
		const columns = getRwaTableColumns('assets', 'ready', '7d')
		expect(getRwaColumnOptions(columns, 'chain').map((option) => option.key)).not.toContain('chains')
		expect(getRwaColumnOptions(columns, 'platform').map((option) => option.key)).not.toContain('platform')
		expect(getRwaColumnOptions(columns, 'assetGroup').map((option) => option.key)).toContain('chains')
	})

	test('names picker entries with their header group so the period columns stay distinguishable', () => {
		const names = getRwaColumnOptions(getRwaTableColumns('assets', 'ready', '7d')).map((option) => option.name)
		expect(new Set(names).size).toBe(names.length)
		expect(names.filter((name) => name.endsWith('7d'))).toEqual(['AUM: 7d', 'DeFi: 7d', 'Flows: 7d'])
	})

	test('gives the perps view its own columns without chains or AUM', () => {
		const ids = buildTable('perps', 'platform')
			.getAllLeafColumns()
			.map((column) => column.id)
		expect(ids).not.toContain('chains')
		expect(ids).not.toContain('activeMcap')
	})

	test('offers the venue column only when CEX venues are included', () => {
		expect(getRwaTableColumns('perps', 'ready', '7d', { includeCex: true }).map((column) => column.id)).toContain(
			'venue'
		)
		expect(getRwaTableColumns('perps', 'ready', '7d').map((column) => column.id)).not.toContain('venue')
	})

	test('renders the perps cells with an annualised funding rate', () => {
		const table = buildTable('perps', 'platform')
		expect(cellText(table, 'perps-usdy', 'openInterest')).toBe('$5,000')
		expect(cellText(table, 'perps-usdy', 'venue')).toBe('DEX')
		expect(cellText(table, 'perps-usdy', 'fundingApr')).toContain('+10.95%')
		expect(cellText(table, 'platform:Hyperliquid', 'premium')).toContain('+0.2%')
		expect(cellText(table, 'perps-usdy', 'maxLeverage')).toBe('50x')
		expect(cellMarkup(table, 'perps-usdy', 'priceChange24h')).toContain('+2.50%')
	})
})

describe('RWA table compliance preset', () => {
	const assets = [
		spotAsset({ attestations: false, kycForMintRedeem: true, transferable: true, selfCustody: true, redeemable: null }),
		spotAsset({
			id: 'b',
			canonicalMarketId: 'b',
			ticker: 'B',
			assetName: 'Beta',
			accessModel: 'Permissionless',
			attestations: true,
			kycForMintRedeem: false,
			activeMcap: { total: 900_000, breakdown: [['Ethereum', 900_000]] }
		})
	]

	function buildCompliance(groupBy: RWAGroupBy): RwaTestTable {
		const columns = getRwaTableColumns('assets', 'ready', '7d', { preset: 'compliance' })
		return constructTable({
			features: headlessFeatures,
			data: groupRwaRows(buildRwaLeafRows(assets, { includeBridgeTvl: true }), groupBy),
			columns,
			getRowId: (row) => row.id,
			getSubRows: (row) => (row.kind === 'group' ? row.children : undefined),
			state: { expanded: true, columnVisibility: getRwaDefaultColumnVisibility('assets', columns, 'compliance') }
		})
	}

	test('paints and offers only the compliance columns, money kept for the export', () => {
		const table = buildCompliance('none')
		expect(paintedColumnIds(table)).toEqual(RWA_COMPLIANCE_COLUMN_IDS)
		expect(table.getAllLeafColumns().map((column) => column.id)).toContain('activeMcap')
		const picker = getRwaColumnOptions(getRwaTableColumns('assets', 'ready', '7d', { preset: 'compliance' }))
		expect(picker.map((option) => option.key).slice(0, RWA_COMPLIANCE_COLUMN_IDS.length)).toEqual(
			RWA_COMPLIANCE_COLUMN_IDS
		)
	})

	test('renders Yes and No on a leaf, blank for unknown, and the tallies on a group row', () => {
		const flat = buildCompliance('none')
		expect(cellText(flat, 'usdy', 'attestations')).toBe('No')
		expect(cellText(flat, 'usdy', 'kycForMintRedeem')).toBe('Yes')
		expect(cellText(flat, 'b', 'attestations')).toBe('Yes')
		expect(cellText(flat, 'usdy', 'redeemable')).toBe('')
		const grouped = buildCompliance('platform')
		expect(cellMarkup(grouped, 'platform:Ondo', 'attestations')).toContain('1 / 2')
		expect(cellMarkup(grouped, 'platform:Ondo', 'accessModel')).toContain('Permissioned')
		expect(cellMarkup(grouped, 'platform:Ondo', 'accessModel')).toContain('Permissionless')
	})
})

describe('RWA table cells', () => {
	const table = buildTable('assets', 'platform')

	test('shows the asset groups on a group row and the classes on an asset row', () => {
		expect(cellMarkup(table, 'platform:Ondo', 'assetGroup')).toContain('Bonds')
		expect(cellMarkup(table, 'usdy', 'assetGroup')).toContain('Bonds')
		expect(
			table
				.getRowModel()
				.rows.find((row) => row.id === 'usdy')
				?.getValue('assetGroup')
		).toBe('Bonds')
		const mixed = constructTable({
			features: headlessFeatures,
			data: groupRwaRows(
				buildRwaLeafRows([spotAsset(), spotAsset({ id: 'b', assetGroup: 'Private Equity & Venture' })], {
					includeBridgeTvl: true
				}),
				'platform'
			),
			columns: getRwaTableColumns('assets', 'ready', '7d'),
			getRowId: (row) => row.id,
			getSubRows: (row) => (row.kind === 'group' ? row.children : undefined),
			state: { expanded: {} }
		})
		expect(mixed.getRowModel().rows[0].getValue('assetGroup')).toBe('Bonds, Private Equity & Venture')
	})

	test('lists distinct details and a Yes tally on a group row instead of leaving them blank', () => {
		const mixed = constructTable({
			features: headlessFeatures,
			data: groupRwaRows(
				buildRwaLeafRows(
					[
						spotAsset({ accessModel: 'Permissioned', redeemable: true, attestations: null }),
						spotAsset({ id: 'b', issuer: 'BlackRock', accessModel: 'Permissionless', redeemable: false }),
						spotAsset({ id: 'c', issuer: 'BlackRock', redeemable: null })
					],
					{ includeBridgeTvl: true }
				),
				'platform'
			),
			columns: getRwaTableColumns('assets', 'ready', '7d'),
			getRowId: (row) => row.id,
			getSubRows: (row) => (row.kind === 'group' ? row.children : undefined),
			state: { expanded: {} }
		})
		const group = mixed.getRowModel().rows[0]
		expect(group.getValue('accessModel')).toBe('Permissioned, Permissionless')
		expect(group.getValue('issuer')).toBe('Ondo, BlackRock')
		expect(group.getValue('redeemable')).toBe('1/2')
		expect(group.getValue('attestations')).toBe('')
		expect(cellMarkup(mixed, 'platform:Ondo', 'issuer')).toContain('Ondo, BlackRock')
		expect(cellMarkup(mixed, 'platform:Ondo', 'redeemable')).toContain('1 / 2')
	})

	test('renders a platform group with a chevron, a link and the asset count', () => {
		const markup = cellMarkup(table, 'platform:Ondo', 'name')
		expect(markup).toContain('aria-expanded="true"')
		expect(markup).toContain('href="/rwa/platform/ondo"')
		expect(markup).toContain('1 asset')
	})

	test('renders the leaf under its parent with the ticker line', () => {
		const markup = cellMarkup(table, 'usdy', 'name')
		expect(markup).toContain('href="/rwa/asset/ondo%2Fusdy"')
		expect(markup).toContain('USDY')
	})

	test('shows the summed active AUM on the group row and each leaf on its own row', () => {
		const columns = getRwaTableColumns('assets', 'ready', '7d')
		const twoAssets = constructTable({
			features: headlessFeatures,
			data: groupRwaRows(
				buildRwaLeafRows(
					[spotAsset(), spotAsset({ id: 'b', activeMcap: { total: 900_000, breakdown: [['Ethereum', 900_000]] } })],
					{ includeBridgeTvl: true }
				),
				'platform'
			),
			columns,
			getRowId: (row) => row.id,
			getSubRows: (row) => (row.kind === 'group' ? row.children : undefined),
			state: { expanded: true, columnVisibility: getRwaDefaultColumnVisibility('assets', columns) }
		})
		expect(cellText(twoAssets, 'platform:Ondo', 'activeMcap')).toBe('$1.7m')
		expect(cellText(twoAssets, 'usdy', 'activeMcap')).toContain('$800,000')
		expect(cellText(twoAssets, 'b', 'activeMcap')).toContain('$900,000')
	})

	test('shows the seven day change with its direction', () => {
		expect(cellText(table, 'usdy', 'activeMcapChange')).toBe('+14.29%')
		expect(cellText(table, 'usdy', 'defiActiveTvlChange')).toBe('+25.00%')
	})

	test('renders the chains as an icon row with links', () => {
		// IconsRow measures its width past two items and this render has none, so two chains show inline.
		const twoChains = spotAsset({
			onChainMcap: {
				total: 995_000,
				breakdown: [
					['Ethereum', 700_000],
					['Solana', 295_000]
				]
			}
		} as Parameters<typeof spotAsset>[0])
		const rows = groupRwaRows(buildRwaLeafRows([twoChains], { includeBridgeTvl: true }), 'platform')
		const columns = getRwaTableColumns('assets', 'ready', '7d', { includeCex: true })
		const small = constructTable({
			features: headlessFeatures,
			data: rows,
			columns,
			getRowId: (row) => row.id,
			getSubRows: (row) => (row.kind === 'group' ? row.children : undefined),
			state: { expanded: true, columnVisibility: getRwaDefaultColumnVisibility('assets', columns) }
		})
		const markup = cellMarkup(small, 'usdy', 'chains')
		expect(markup).toContain('Ethereum')
		expect(markup).toContain('/rwa/chain/solana')
	})

	test('exports every leaf under a collapsed group', () => {
		const collapsed = buildTable('assets', 'platform', {})
		expect(collapsed.getPrePaginatedRowModel().rows.map((row) => row.id)).toEqual(['platform:Ondo'])
		const csv = prepareTableCsv({ instance: collapsed, filename: 'rwa-assets', rows: getRwaCsvRows(collapsed) }).rows
		expect(csv.slice(1).map((row) => row[0])).toEqual(['Ondo', 'Ondo USDY'])
	})

	test('exports the csv-only columns and the chains as names', () => {
		const flat = buildTable('assets', 'none')
		const csv = prepareTableCsv({ instance: flat, filename: 'rwa-assets' }).rows
		// Category, Classification and the five attribute flags ride along in every export without being painted.
		expect(csv[0]).toContain('Category')
		expect(csv[0]).toContain('Transferable')
		expect(csv[0]).toContain('Asset Class')
		expect(csv[0]).toContain('Active AUM')
		expect(csv[1][csv[0].indexOf('Chains')]).toBe('Ethereum, Solana, Mantle')
		expect(csv[1][csv[0].indexOf('Suspicious')]).toBe(false)
	})

	test('exports the stored flag for spot rows and the tally for groups', () => {
		const columns = getRwaTableColumns('assets', 'ready', '7d')
		const grouped = constructTable({
			features: headlessFeatures,
			data: groupRwaRows(
				buildRwaLeafRows(
					[
						spotAsset({ attestations: true }),
						spotAsset({ id: 'b', attestations: false }),
						spotAsset({ id: 'c', attestations: null })
					],
					{ includeBridgeTvl: true }
				),
				'platform'
			),
			columns,
			getRowId: (row) => row.id,
			getSubRows: (row) => (row.kind === 'group' ? row.children : undefined),
			state: { expanded: true, columnVisibility: getRwaDefaultColumnVisibility('assets', columns) }
		})
		const csv = prepareTableCsv({ instance: grouped, filename: 'rwa-assets', includeHiddenColumns: true }).rows
		const column = csv[0].indexOf('Attestations')
		expect(csv.slice(1).map((row) => row[column])).toEqual(['1/2', true, false, ''])
	})
})
