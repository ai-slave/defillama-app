import { type ColumnDef, type Table, useTable } from '@tanstack/react-table'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import type { ProtocolAggregateTableRow } from '../../../../unifiedTable/contracts'
import { tableFeaturesConfig } from '../../core/useUnifiedTable'
import { buildProtocolTableReadModel } from '../../readModel'
import type { ProtocolTableRow } from '../../types'
import { buildGroupedCsvData, getRowsAtGroupLevel } from '../csvExport'

function protocol(
	id: string,
	{
		category = null,
		chains = ['Base'],
		oracles = []
	}: { category?: string | null; chains?: Array<string>; oracles?: Array<string> } = {}
): ProtocolAggregateTableRow {
	return {
		rowType: 'protocol',
		id,
		name: id,
		protocolId: id,
		displayName: id,
		logo: `${id}.png`,
		category,
		chains,
		oracles,
		parentProtocolId: null,
		parentProtocolName: null,
		parentProtocolLogo: null,
		metrics: { tvl: 1 },
		chain: null
	}
}

describe('Unified Table CSV export', () => {
	test('reads all filtered rows before pagination', () => {
		const rows = buildProtocolTableReadModel({
			rows: [protocol('Alpha'), protocol('Beta'), protocol('Gamma')],
			rowHeaders: ['protocol'],
			parentMetrics: {},
			chainMetrics: {},
			customColumns: []
		}).rows
		const columns: Array<ColumnDef<typeof tableFeaturesConfig, ProtocolTableRow>> = [
			{ id: 'name', accessorKey: 'displayName', header: 'Protocol' }
		]
		const rendered: { table?: Table<typeof tableFeaturesConfig, ProtocolTableRow> } = {}

		function Probe() {
			rendered.table = useTable({
				features: tableFeaturesConfig,
				data: rows,
				columns,
				state: { pagination: { pageIndex: 0, pageSize: 1 } },
				getSubRows: (row) => (row.nodeType === 'group' ? row.subRows : undefined)
			})
			return null
		}

		renderToStaticMarkup(<Probe />)
		const table = rendered.table
		if (!table) throw new Error('Expected the table hook to render')
		expect(table.getRowModel().rows).toHaveLength(1)

		const exportRows = getRowsAtGroupLevel(table, 'protocol')
		const csv = buildGroupedCsvData({
			rows: exportRows,
			columns: table.getVisibleLeafColumns(),
			percentColumns: new Set(),
			level: 'protocol',
			customColumns: []
		})
		expect(csv.data).toEqual([['Alpha'], ['Beta'], ['Gamma']])
	})

	test('exports expanded hierarchies once and preserves visible metadata', () => {
		const rows = buildProtocolTableReadModel({
			rows: [
				protocol('Alpha', { category: 'Dexes', chains: ['Base'], oracles: ['Chainlink'] }),
				protocol('Beta', { category: 'Dexes', chains: ['Base'], oracles: ['Pyth'] })
			],
			rowHeaders: ['category', 'protocol'],
			parentMetrics: {},
			chainMetrics: {},
			customColumns: []
		}).rows
		const columns: Array<ColumnDef<typeof tableFeaturesConfig, ProtocolTableRow>> = [
			{ id: 'name', accessorKey: 'displayName', header: 'Name' },
			{ id: 'category', accessorKey: 'category', header: 'Category' },
			{ id: 'chains', accessorKey: 'chains', header: 'Chains' },
			{ id: 'oracles', accessorKey: 'oracles', header: 'Oracles' }
		]
		const rendered: { table?: Table<typeof tableFeaturesConfig, ProtocolTableRow> } = {}

		function Probe() {
			rendered.table = useTable({
				features: tableFeaturesConfig,
				data: rows,
				columns,
				state: { expanded: true },
				getSubRows: (row) => (row.nodeType === 'group' ? row.subRows : undefined)
			})
			return null
		}

		renderToStaticMarkup(<Probe />)
		const table = rendered.table
		if (!table) throw new Error('Expected the table hook to render')
		const protocolRows = getRowsAtGroupLevel(table, 'protocol')
		expect(protocolRows.map((row) => row.original.displayName)).toEqual(['Alpha', 'Beta'])
		expect(
			buildGroupedCsvData({
				rows: protocolRows,
				columns: table.getVisibleLeafColumns(),
				percentColumns: new Set(),
				level: 'protocol',
				customColumns: []
			}).data
		).toEqual([
			['Alpha', 'Alpha', 'Dexes', 'Base', 'Chainlink'],
			['Beta', 'Beta', 'Dexes', 'Base', 'Pyth']
		])

		const categoryRows = getRowsAtGroupLevel(table, 'category')
		expect(
			buildGroupedCsvData({
				rows: categoryRows,
				columns: table.getVisibleLeafColumns(),
				percentColumns: new Set(),
				level: 'category',
				customColumns: []
			}).data
		).toEqual([['Dexes', 'Dexes', 'Base', 'Chainlink;Pyth']])
	})
})
