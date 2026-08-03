import type { Column, Row, Table } from '@tanstack/react-table'
import { formatFixedNumber } from '~/utils/numberFormat'
import { isProtocolTableMetricKey } from '../../../unifiedTable/config/columnDictionary'
import { getFilteredShareMetricKey } from '../../../unifiedTable/config/filteredShareColumns'
import type { CustomColumnDefinition, UnifiedRowHeaderType } from '../../../unifiedTable/config/types'
import type { ProtocolTableRow } from '../types'
import { isCustomColumnId } from './customColumns'

export function getRowsAtGroupLevel(
	table: Table<ProtocolTableRow>,
	level: UnifiedRowHeaderType
): Row<ProtocolTableRow>[] {
	const result: Row<ProtocolTableRow>[] = []

	const collectRows = (rows: Row<ProtocolTableRow>[]) => {
		for (const row of rows) {
			if (row.original.nodeType === 'group') {
				if (row.original.header === level) {
					result.push(row)
				} else if (row.subRows?.length) {
					collectRows(row.subRows)
				}
			} else if (level === 'protocol') {
				result.push(row)
			}
		}
	}

	const rowModel = table.getPreExpandedRowModel()
	collectRows(rowModel.rows)

	return result
}

export function getProtocolTableCsvValue(
	row: ProtocolTableRow,
	columnId: string,
	percentColumns: Set<string>,
	customColumnsById: ReadonlyMap<string, CustomColumnDefinition>
): string {
	if (columnId === 'name') {
		return row.displayName
	}

	if (columnId === 'chain') {
		if (row.nodeType === 'leaf') return row.chain ?? ''
		return row.header === 'chain' ? row.displayName : row.chains.join(';')
	}

	if (columnId === 'category') {
		if (row.nodeType === 'group' && row.header === 'category') return row.displayName
		return row.category ?? ''
	}

	if (columnId === 'chains') {
		return row.chains.join(';')
	}

	if (columnId === 'oracles') {
		return row.oracles.join(';')
	}

	if (isCustomColumnId(columnId)) {
		const customColumn = customColumnsById.get(columnId)
		if (!customColumn) return ''
		const value = row.customValues[customColumn.id] ?? null
		if (value == null) {
			return ''
		}
		if (typeof value !== 'number') return ''
		return customColumn.format === 'percent' ? formatFixedNumber(value, 2) : String(value)
	}

	const shareMetric = getFilteredShareMetricKey(columnId)
	const value = shareMetric
		? row.filteredShares[shareMetric]
		: isProtocolTableMetricKey(columnId)
			? row.metrics[columnId]
			: null

	if (value == null) {
		return ''
	}

	if (percentColumns.has(columnId) && typeof value === 'number') {
		return formatFixedNumber(value, 2)
	}

	return typeof value === 'number' ? String(value) : ''
}

const GROUP_LEVEL_HEADERS: Record<UnifiedRowHeaderType, string> = {
	chain: 'Chain',
	category: 'Category',
	'parent-protocol': 'Protocol Group',
	protocol: 'Protocol'
}

export function buildGroupedCsvData({
	rows,
	columns,
	percentColumns,
	level,
	customColumns
}: {
	rows: Row<ProtocolTableRow>[]
	columns: Column<ProtocolTableRow>[]
	percentColumns: Set<string>
	level: UnifiedRowHeaderType
	customColumns: readonly CustomColumnDefinition[]
}): { headers: string[]; data: string[][] } {
	const groupHeader = GROUP_LEVEL_HEADERS[level]
	const customColumnsById = new Map(customColumns.map((column) => [column.id, column]))
	const columnHeaders = columns.map((column) => {
		const header = column.columnDef.header
		return typeof header === 'string' ? header : (column.id ?? '')
	})

	const hasGroupColumn = columnHeaders.some((h) => h.toLowerCase() === groupHeader.toLowerCase())

	if (hasGroupColumn) {
		const data = rows.map((row) =>
			columns.map((column) => getProtocolTableCsvValue(row.original, column.id, percentColumns, customColumnsById))
		)
		return { headers: columnHeaders, data }
	}

	const nameIndex = columnHeaders.findIndex((h) => h === 'Name' || h === 'name')
	const insertIndex = nameIndex >= 0 ? nameIndex + 1 : 0
	const headers = [...columnHeaders.slice(0, insertIndex), groupHeader, ...columnHeaders.slice(insertIndex)]

	const data = rows.map((row) => {
		const display = row.original
		const rowData: string[] = []
		for (let index = 0; index <= columns.length; index++) {
			if (index === insertIndex) rowData.push(display.displayName)
			const column = columns[index]
			if (column) rowData.push(getProtocolTableCsvValue(display, column.id, percentColumns, customColumnsById))
		}
		return rowData
	})

	return { headers, data }
}
