import { constructTable, type ExpandedState, flexRender, type Table } from '@tanstack/react-table'
import { storeReactivityBindings } from '@tanstack/table-core/store-reactivity-bindings'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { prepareTableCsv } from '~/components/Table/utils'
import { formatRwaMultiple } from '../../kpi/format'
import type { RWAPageKind, RWASection } from '../../layout/pageLayout'
import { formatFundingRateDetail } from '../columns/perpsMetrics'
import type { RWATableColumnSet } from '../columnSetQuery'
import {
	getRwaColumnOptions,
	getRwaDefaultColumnVisibility,
	getRwaTableColumns,
	RWA_COMPLIANCE_COLUMN_IDS
} from '../columnSets'
import { rwaTableFeatures, type RwaTableFeatures } from '../features'
import type { RWAGroupBy } from '../groupBy'
import { groupRwaRows } from '../grouping'
import { buildRwaLeafRows, type RWATableRow } from '../rows'
import { perpsAsset, spotAsset } from './fixtures'

type RwaTestTable = Table<RwaTableFeatures, RWATableRow>

/** A headless instance outside React needs a store for its state. */
const headlessFeatures = { ...rwaTableFeatures, coreReactivityFeature: storeReactivityBindings() }

function buildTable(
	section: RWASection,
	groupBy: RWAGroupBy,
	expanded: ExpandedState = true,
	columnSet: RWATableColumnSet = 'metrics'
): RwaTestTable {
	const kind = section === 'perps' ? 'perps' : 'spot'
	const assets = [spotAsset(), perpsAsset()].filter((asset) => asset.kind === kind)
	const columns = getRwaTableColumns(section === 'perps' ? 'perpsOverview' : 'overview', 'ready', '7d', columnSet)
	return constructTable({
		features: headlessFeatures,
		data: groupRwaRows(buildRwaLeafRows(assets, { includeBridgeTvl: true }), groupBy),
		columns,
		getRowId: (row) => row.id,
		getSubRows: (row) => (row.kind === 'group' ? row.children : undefined),
		state: { expanded, columnVisibility: getRwaDefaultColumnVisibility(section, columns, columnSet) }
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
		expect(paintedColumnIds(table)).toEqual([
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
		])
		const csvOnly = table
			.getAllLeafColumns()
			.filter((column) => column.columnDef.meta?.csvOnly)
			.map((column) => column.id)
		expect(csvOnly).toContain('kycForMintRedeem')
		const pickerKeys = getRwaColumnOptions(
			getRwaTableColumns('overview', 'ready', '7d', 'metrics'),
			'none',
			'overview'
		).map((option) => option.key)
		for (const id of csvOnly) expect(pickerKeys).not.toContain(id)
	})

	test('drops the column a grouping makes redundant from the picker', () => {
		const columns = getRwaTableColumns('overview', 'ready', '7d', 'metrics')
		const keys = (groupBy: RWAGroupBy) => getRwaColumnOptions(columns, groupBy, 'overview').map((option) => option.key)
		expect(keys('chain')).not.toContain('chains')
		expect(keys('platform')).not.toContain('platform')
		expect(keys('assetGroup')).toContain('chains')
	})

	test('names picker entries with their header group so the period columns stay distinguishable', () => {
		const names = getRwaColumnOptions(getRwaTableColumns('overview', 'ready', '7d', 'metrics'), 'none', 'overview').map(
			(option) => option.name
		)
		expect(new Set(names).size).toBe(names.length)
		expect(names.filter((name) => name.endsWith('7d'))).toEqual(['AUM: 7d', 'DeFi: 7d', 'Flows: 7d'])
	})

	test('gives the perps view its own columns without chains or AUM', () => {
		const ids = buildTable('perps', 'platform')
			.getAllLeafColumns()
			.map((column) => column.id)
		expect(ids).toContain('openInterest')
		expect(ids).not.toContain('chains')
		expect(ids).not.toContain('activeMcap')
	})

	test('paints Asset Group on the perps table by default', () => {
		expect(paintedColumnIds(buildTable('perps', 'none'))).toContain('assetGroup')
	})

	test('leaves the open-only perps columns unpainted by default but offers them in the picker', () => {
		const painted = new Set(paintedColumnIds(buildTable('perps', 'none')))
		const keys = new Set(
			getRwaColumnOptions(getRwaTableColumns('perpsOverview', 'ready', '7d', 'metrics'), 'none', 'perpsOverview').map(
				(option) => option.key
			)
		)
		for (const id of ['pair', 'premium', 'fundingApr', 'maxLeverage']) {
			expect({ id, painted: painted.has(id), offered: keys.has(id) }).toEqual({
				id,
				painted: false,
				offered: true
			})
		}
	})

	test('keeps the csv-only perps columns out of the picker', () => {
		const csvOnly = buildTable('perps', 'none')
			.getAllLeafColumns()
			.filter((column) => column.columnDef.meta?.csvOnly)
			.map((column) => column.id)
		expect(csvOnly).toContain('parentPlatform')
		const keys = getRwaColumnOptions(
			getRwaTableColumns('perpsOverview', 'ready', '7d', 'metrics'),
			'none',
			'perpsOverview'
		).map((option) => option.key)
		for (const id of csvOnly) expect(keys).not.toContain(id)
	})

	test('drops the Venue column under Group by Venue and on a venue page', () => {
		const columns = getRwaTableColumns('perpsOverview', 'ready', '7d', 'metrics')
		const keys = (groupBy: RWAGroupBy, pageKind: RWAPageKind) =>
			getRwaColumnOptions(columns, groupBy, pageKind).map((option) => option.key)
		expect(keys('none', 'perpsOverview')).toContain('platform')
		expect(keys('platform', 'perpsOverview')).not.toContain('platform')
		expect(keys('none', 'venue')).not.toContain('platform')
	})

	test('names a market by its contract and asset, without its pair or venue type', () => {
		const name = cellText(buildTable('perps', 'platform'), 'perps-usdy', 'name')
		expect(name).toContain('hl:USDY')
		expect(name).toContain('USDY Perp')
		expect(name).not.toContain('USDY/USDC')
		expect(name).not.toContain('DEX')
	})

	test('tags the venue with its type on the venue group row and in the Venue cell, linked to the venue page', () => {
		const table = buildTable('perps', 'platform')
		expect(cellText(table, 'platform:Hyperliquid', 'name')).toContain('DEX')
		expect(cellText(table, 'perps-usdy', 'platform')).toBe('HyperliquidDEX')
		expect(cellMarkup(table, 'perps-usdy', 'platform')).toContain('href="/rwa/perps/venue/hyperliquid"')
	})

	test('keeps the venue type off a non-venue group row', () => {
		const name = cellText(buildTable('perps', 'assetGroup'), 'assetGroup:Bonds', 'name')
		expect(name).toContain('Bonds')
		expect(name).not.toContain('DEX')
	})

	test('reads the perps Asset Group column as the groups on a group row and the class on a market', () => {
		const table = buildTable('perps', 'platform')
		expect(cellText(table, 'platform:Hyperliquid', 'assetGroup')).toBe('Bonds')
		expect(cellText(table, 'perps-usdy', 'assetGroup')).toBe('Bond Perp')
	})

	test('shows a market spec on its row and lists it on the venue row', () => {
		const table = buildTable('perps', 'platform')
		expect(cellText(table, 'perps-usdy', 'asset')).toBe('USDY Perp')
		expect(cellText(table, 'perps-usdy', 'pair')).toBe('USDY/USDC')
		expect(cellText(table, 'platform:Hyperliquid', 'pair')).toBe('USDY/USDC')
		expect(cellText(table, 'perps-usdy', 'fundingInterval')).toBe('8h')
	})

	test('leaves premium and max leverage empty on a venue row, where a blend of underlyings means nothing', () => {
		const table = buildTable('perps', 'platform')
		expect(cellText(table, 'perps-usdy', 'premium')).toContain('+0.2%')
		expect(cellText(table, 'platform:Hyperliquid', 'premium')).toBe('')
		expect(cellText(table, 'perps-usdy', 'maxLeverage')).toBe('50x')
		expect(cellText(table, 'platform:Hyperliquid', 'maxLeverage')).toBe('')
	})

	test('signs the funding APR and the 24h price change', () => {
		const table = buildTable('perps', 'platform')
		expect(cellText(table, 'perps-usdy', 'fundingApr')).toContain('+10.95%')
		expect(cellText(table, 'perps-usdy', 'priceChange24h')).toBe('+2.50%')
	})

	test('prints open interest in dollars, turnover as a multiple and fee rates to four decimals', () => {
		const table = buildTable('perps', 'platform')
		expect(cellText(table, 'perps-usdy', 'openInterest')).toBe('$5,000')
		expect(cellText(table, 'perps-usdy', 'turnover30d')).toBe('4x')
		expect(cellText(table, 'perps-usdy', 'makerFeeRate')).toBe('0.0150%')
	})

	test('counts the venues of a group that spans several, the names in the tooltip', () => {
		const rows = groupRwaRows(
			buildRwaLeafRows(
				[perpsAsset(), perpsAsset({ id: 'bin', contract: 'bin:USDY', venue: 'Binance', parentPlatform: 'Binance' })],
				{ includeBridgeTvl: true }
			),
			'assetGroup'
		)
		const table = constructTable({
			features: headlessFeatures,
			data: rows,
			columns: getRwaTableColumns('perpsOverview', 'ready', '7d', 'metrics'),
			getRowId: (row) => row.id,
			getSubRows: (row) => (row.kind === 'group' ? row.children : undefined),
			state: { expanded: {} }
		})
		expect(cellText(table, 'assetGroup:Bonds', 'platform')).toBe('2 venues')
		expect(cellText(buildTable('perps', 'assetGroup'), 'assetGroup:Bonds', 'platform')).toBe('Hyperliquid')
	})

	test('fills an access model or funding cell on a group row only where one value applies to the whole group', () => {
		const rows = groupRwaRows(
			buildRwaLeafRows(
				[
					perpsAsset({ accessModel: 'Permissionless', marginAsset: 'USDC' }),
					perpsAsset({
						id: 'b',
						contract: 'hl:B',
						accessModel: 'Permissionless',
						marginAsset: 'USDT',
						fundingIntervalHours: 1
					})
				],
				{ includeBridgeTvl: true }
			),
			'platform'
		)
		const table = constructTable({
			features: headlessFeatures,
			data: rows,
			columns: getRwaTableColumns('perpsOverview', 'ready', '7d', 'metrics'),
			getRowId: (row) => row.id,
			getSubRows: (row) => (row.kind === 'group' ? row.children : undefined),
			state: { expanded: {} }
		})
		const group = table.getRowModel().rows[0]
		expect(group.getValue('fundingInterval')).toBeUndefined()
		expect(group.getValue('accessModel')).toBe('Permissionless')
		expect(cellText(table, 'platform:Hyperliquid', 'accessModel')).toBe('Permissionless')
	})

	test('shows -100% on a market that fell to zero and marks the group change that leaves it out', () => {
		const rows = groupRwaRows(
			buildRwaLeafRows(
				[
					perpsAsset({ id: 'up', openInterest: 1_000_000, openInterestChange24h: 25 }),
					perpsAsset({ id: 'gone', contract: 'hl:GONE', openInterest: 0, openInterestChange24h: -100 })
				],
				{ includeBridgeTvl: true }
			),
			'platform'
		)
		const table = constructTable({
			features: headlessFeatures,
			data: rows,
			columns: getRwaTableColumns('perpsOverview', 'ready', '7d', 'metrics'),
			getRowId: (row) => row.id,
			getSubRows: (row) => (row.kind === 'group' ? row.children : undefined),
			state: { expanded: true }
		})
		expect(cellText(table, 'gone', 'openInterestChange24h')).toBe('-100.00%')
		expect(cellText(table, 'platform:Hyperliquid', 'openInterestChange24h')).toBe('+25.00%*')
	})

	test('drops the asset line under a market name on the asset page, which names the asset', () => {
		const table = constructTable({
			features: headlessFeatures,
			data: buildRwaLeafRows([perpsAsset()], { includeBridgeTvl: true }),
			columns: getRwaTableColumns('perpsAsset', 'ready', '7d', 'metrics'),
			getRowId: (row) => row.id,
			state: {}
		})
		expect(cellText(table, 'perps-usdy', 'name')).toBe('hl:USDY')
		expect(cellText(buildTable('perps', 'none'), 'perps-usdy', 'name')).toContain('USDY Perp')
	})

	test('exports the csv-only perps fields with every market, none of them empty on every row', () => {
		const csv = prepareTableCsv({ instance: buildTable('perps', 'none'), filename: 'rwa-perps' }).rows
		for (const header of ['RWA Classification', 'Parent Platform', 'Settlement Asset']) {
			expect(csv[0]).toContain(header)
		}
		expect(csv[0]).not.toContain('Category')
		expect(csv[0]).not.toContain('Description')
		expect(csv[1][csv[0].indexOf('ID')]).toBe('perps-usdy')
		expect(csv[1][csv[0].indexOf('Timestamp')]).toBe(1_760_000_000)
	})
})

describe('perps cell formats', () => {
	test('the funding tooltip prints the raw rate per interval with three significant digits', () => {
		expect(formatFundingRateDetail(0.00000625, 1)).toBe('+0.000625% per 1h, annualized.')
		expect(formatFundingRateDetail(-0.000123456, 8)).toBe('-0.0123% per 8h, annualized.')
	})

	test('max leverage prints a rounded ratio', () => {
		expect(formatRwaMultiple(3.0003000300030003, 2)).toBe('3x')
		expect(formatRwaMultiple(30.03003003003003, 2)).toBe('30.03x')
		expect(formatRwaMultiple(50, 2)).toBe('50x')
	})
})

describe('RWA table compliance column set', () => {
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
		const columns = getRwaTableColumns('overview', 'ready', '7d', 'compliance')
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
		const picker = getRwaColumnOptions(getRwaTableColumns('overview', 'ready', '7d', 'compliance'), 'none', 'platform')
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
			columns: getRwaTableColumns('overview', 'ready', '7d', 'metrics'),
			getRowId: (row) => row.id,
			getSubRows: (row) => (row.kind === 'group' ? row.children : undefined),
			state: { expanded: {} }
		})
		expect(mixed.getRowModel().rows[0].getValue('assetGroup')).toBe('Bonds, Private Equity & Venture')
	})

	test('links every asset group a group row lists to its page, on asset and perps rows alike', () => {
		const groupRows = (section: RWASection) => {
			const assets =
				section === 'perps'
					? [
							perpsAsset(),
							perpsAsset({ id: 'p2', contract: 'hl:SPX', assetName: 'Nasdaq 100', assetGroup: 'Equity Indices' })
						]
					: [spotAsset(), spotAsset({ id: 'b', assetGroup: 'Private Equity & Venture' })]
			return constructTable({
				features: headlessFeatures,
				data: groupRwaRows(buildRwaLeafRows(assets, { includeBridgeTvl: true }), 'platform'),
				columns: getRwaTableColumns(section === 'perps' ? 'perpsOverview' : 'overview', 'ready', '7d', 'metrics'),
				getRowId: (row) => row.id,
				getSubRows: (row) => (row.kind === 'group' ? row.children : undefined),
				state: { expanded: {} }
			})
		}
		const spot = cellMarkup(groupRows('assets'), 'platform:Ondo', 'assetGroup')
		expect(spot).toContain('href="/rwa/asset-group/bonds"')
		expect(spot).toContain('href="/rwa/asset-group/private-equity-venture"')
		const perps = groupRows('perps')
		expect(cellMarkup(perps, 'platform:Hyperliquid', 'assetGroup')).toContain(
			'href="/rwa/perps/asset-group/equity-indices"'
		)
		expect(cellMarkup(perps, 'platform:Hyperliquid', 'asset')).toContain('href="/rwa/perps/asset/nasdaq-100"')
		expect(cellText(perps, 'platform:Hyperliquid', 'asset')).toBe('USDY Perp, Nasdaq 100')
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
			columns: getRwaTableColumns('overview', 'ready', '7d', 'metrics'),
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
		const columns = getRwaTableColumns('overview', 'ready', '7d', 'metrics')
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
			state: { expanded: true, columnVisibility: getRwaDefaultColumnVisibility('assets', columns, 'metrics') }
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
		const columns = getRwaTableColumns('overview', 'ready', '7d', 'metrics')
		const small = constructTable({
			features: headlessFeatures,
			data: rows,
			columns,
			getRowId: (row) => row.id,
			getSubRows: (row) => (row.kind === 'group' ? row.children : undefined),
			state: { expanded: true, columnVisibility: getRwaDefaultColumnVisibility('assets', columns, 'metrics') }
		})
		const markup = cellMarkup(small, 'usdy', 'chains')
		expect(markup).toContain('Ethereum')
		expect(markup).toContain('/rwa/chain/solana')
	})

	test('exports the rows as the table shows them: a closed group alone, an open one with its assets', () => {
		const exported = (expanded: ExpandedState) =>
			prepareTableCsv({ instance: buildTable('assets', 'platform', expanded), filename: 'rwa-table' })
				.rows.slice(1)
				.map((row) => row[0])
		expect(exported({})).toEqual(['Ondo'])
		expect(exported({ 'platform:Ondo': true })).toEqual(['Ondo', 'Ondo USDY'])
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
		const columns = getRwaTableColumns('overview', 'ready', '7d', 'metrics')
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
			state: { expanded: true, columnVisibility: getRwaDefaultColumnVisibility('assets', columns, 'metrics') }
		})
		const csv = prepareTableCsv({ instance: grouped, filename: 'rwa-assets', includeHiddenColumns: true }).rows
		const column = csv[0].indexOf('Attestations')
		expect(csv.slice(1).map((row) => row[column])).toEqual(['1/2', true, false, ''])
	})
})
