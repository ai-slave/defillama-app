import { constructTable, type ExpandedState, flexRender, type Table } from '@tanstack/react-table'
import { storeReactivityBindings } from '@tanstack/table-core/store-reactivity-bindings'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { prepareTableCsv } from '~/components/Table/utils'
import {
	getRwaColumnOptions,
	getRwaDefaultColumnVisibility,
	getRwaTableColumns,
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

describe('RWA table column set', () => {
	test('shows the nine default columns for assets and only those', () => {
		const table = buildTable('assets', 'platform')
		expect(paintedColumnIds(table)).toEqual([...RWA_DEFAULT_COLUMN_IDS.assets])
		expect(getRwaColumnOptions(getRwaTableColumns('assets', 'ready', '7d')).map((option) => option.key)).toEqual([
			'name',
			'chains',
			'assetGroup',
			'activeMcap',
			'onChainMcap',
			'activeMcapChange',
			'defiActiveTvl',
			'utilization',
			'defiActiveTvlChange',
			'netFlow',
			'price',
			'platform',
			'issuer',
			'accessModel',
			'redeemable',
			'attestations'
		])
	})

	test('drops the column a grouping makes redundant from the picker', () => {
		const columns = getRwaTableColumns('assets', 'ready', '7d')
		expect(getRwaColumnOptions(columns, 'chain').map((option) => option.key)).not.toContain('chains')
		expect(getRwaColumnOptions(columns, 'platform').map((option) => option.key)).not.toContain('platform')
		expect(getRwaColumnOptions(columns, 'assetGroup').map((option) => option.key)).toContain('chains')
	})

	test('names picker entries with their header group', () => {
		const names = getRwaColumnOptions(getRwaTableColumns('assets', 'ready', '7d')).map((option) => option.name)
		expect(names).toContain('AUM: Active')
		expect(names).toContain('AUM: 7d')
		expect(names).toContain('DeFi: 7d')
		expect(names).toContain('Flows: 7d')
		expect(names).not.toContain('Flows: 30d')
		expect(names).toContain('Asset Type')
		expect(names).not.toContain('Asset Class')
		expect(names).not.toContain('Type')
		expect(names).not.toContain('Category')
		expect(names).toContain('Price')
		expect(names).not.toContain('Pricing: Price')
	})

	test('gives the perps view its own columns without chains or AUM', () => {
		const table = buildTable('perps', 'platform')
		expect(paintedColumnIds(table)).toEqual([...RWA_DEFAULT_COLUMN_IDS.perps])
		expect(table.getAllLeafColumns().map((column) => column.id)).not.toContain('chains')
		expect(table.getAllLeafColumns().map((column) => column.id)).not.toContain('activeMcap')
		expect(cellMarkup(table, 'perps-usdy', 'openInterest')).toBe('$5,000')
		expect(cellMarkup(table, 'perps-usdy', 'venue')).toContain('<span class="text-data-up">DEX</span>')
		expect(cellMarkup(table, 'platform:Hyperliquid', 'venue')).toContain('text-data-up')
		const dexOnly = getRwaTableColumns('perps', 'ready', '7d').map((column) => column.id)
		expect(dexOnly).not.toContain('venue')
		expect(table.getAllLeafColumns().map((column) => column.id)).not.toContain('assetCount')
		expect(
			getRwaColumnOptions(getRwaTableColumns('perps', 'ready', '7d', { includeCex: true })).map((o) => o.key)
		).toEqual([
			'name',
			'venue',
			'assetGroup',
			'openInterest',
			'volume24h',
			'volume30d',
			'fundingApr',
			'premium',
			'price',
			'priceChange24h',
			'openInterestChange24h',
			'volume7d',
			'maxLeverage',
			'protocolFees24h',
			'platform'
		])
		expect(cellMarkup(table, 'perps-usdy', 'fundingApr')).toContain('+10.95%')
		expect(cellMarkup(table, 'perps-usdy', 'fundingApr')).toContain('text-data-down')
		expect(cellMarkup(table, 'platform:Hyperliquid', 'premium')).toContain('+0.2%')
		expect(cellMarkup(table, 'platform:Hyperliquid', 'premium')).toContain('text-data-down')
		expect(cellMarkup(table, 'perps-usdy', 'maxLeverage')).toBe('50x')
		const perpsOptions = getRwaColumnOptions(getRwaTableColumns('perps', 'ready', '7d'))
		expect(perpsOptions.find((option) => option.key === 'priceChange24h')?.name).toBe('Price: 24h')
		expect(cellMarkup(table, 'perps-usdy', 'priceChange24h')).toContain('+2.50%')
		const headers = getRwaTableColumns('assets', 'ready', '1m')
			.flatMap((c) => ('columns' in c && c.columns ? c.columns : [c]))
			.map((c) => c.header)
		expect(headers.filter((h) => h === '1m')).toHaveLength(3)
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
		expect(mixed.getRowModel().rows[0].getValue('assetGroup')).toBe(
			'Bonds, Private Equity &amp; Venture'.replace('&amp;', '&')
		)
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
		expect(markup).toContain('pl-12')
		expect(markup).toContain('href="/rwa/asset/ondo%2Fusdy"')
		expect(markup).toContain('USDY')
	})

	test('shows the group sum as plain text and the leaf value with a breakdown', () => {
		expect(cellMarkup(table, 'platform:Ondo', 'activeMcap')).toBe('$800,000')
		expect(cellMarkup(table, 'usdy', 'activeMcap')).toContain('$800,000')
		expect(cellMarkup(table, 'usdy', 'activeMcap')).toContain('decoration-dotted')
	})

	test('shows the seven day change with its direction', () => {
		expect(cellMarkup(table, 'usdy', 'activeMcapChange')).toBe('<span class="text-data-up">+14.29%</span>')
		expect(cellMarkup(table, 'usdy', 'defiActiveTvlChange')).toBe('<span class="text-data-up">+25.00%</span>')
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

	test('exports self describing headers and chain names', () => {
		const flat = buildTable('assets', 'none')
		const csv = prepareTableCsv({ instance: flat, filename: 'rwa-assets' }).rows
		expect(csv[0].slice(0, 10)).toEqual([
			'Name',
			'Chains',
			'Asset Group',
			'Active AUM',
			'Onchain AUM',
			'Active AUM 7d change',
			'DeFi Active TVL',
			'DeFi Utilization',
			'DeFi Active TVL 7d change',
			'Net Flow 7d'
		])
		// Category, Classification and the five attribute flags ride along in every export without being painted.
		expect(csv[0]).toContain('Category')
		expect(csv[0]).toContain('Transferable')
		expect(csv[0]).toContain('Asset Class')
		expect(csv[0]).toHaveLength(20)
		expect(csv[0].slice(-2)).toEqual(['Suspicious', 'Suspicious reason'])
		expect(csv[1][1]).toBe('Ethereum, Solana, Mantle')
		expect(csv[1][csv[0].indexOf('Suspicious')]).toBe(false)
	})

	test('exports the stored flag for spot rows and the tally for groups', () => {
		const grouped = buildTable('assets', 'platform')
		const csv = prepareTableCsv({ instance: grouped, filename: 'rwa-assets', includeHiddenColumns: true }).rows
		const column = csv[0].indexOf('Attestations')
		expect(column).toBeGreaterThan(0)
		expect(csv[1][column]).toBe('')
		expect(csv[2][column]).toBe('')
	})
})
