import type { ChartConfig } from '~/containers/Downloads/sql/chartConfig'
import { extractTableRefs } from '~/containers/Downloads/sql/completions'
import type { QueryResult } from '~/containers/Downloads/sql/exportResults'
import type { RegisteredTable } from '~/containers/Downloads/sql/useTableRegistry'
import type { SqlChartConfig } from '../../types'
import { generateItemId } from '../../utils/dashboardUtils'
import { captureSnapshot, clampRowCap, SQL_SNAPSHOT_ROW_CAP } from './snapshot'

interface BuildSqlChartConfigParams {
	editItem: SqlChartConfig | null
	name: string
	sql: string
	result: QueryResult
	ranFresh: boolean
	chartConfig: ChartConfig
	displayMode: 'chart' | 'table'
	rowCap: number
	registryTables: RegisteredTable[]
}

export function buildSqlChartConfig({
	editItem,
	name,
	sql,
	result,
	ranFresh,
	chartConfig,
	displayMode,
	rowCap,
	registryTables
}: BuildSqlChartConfigParams): SqlChartConfig {
	const trimmedSql = sql.trim()
	const trimmedName = name.trim()
	const cap = clampRowCap(rowCap)
	const snapshot = ranFresh
		? captureSnapshot(result, 'browser', undefined, cap)
		: (editItem?.snapshot ?? captureSnapshot(result, 'browser', undefined, cap))
	const referencedTables = new Set(extractTableRefs(trimmedSql))
	const tableSources = ranFresh
		? registryTables.filter((t) => referencedTables.has(t.name)).map((t) => t.source)
		: (editItem?.query.tableSources ?? [])
	return {
		id: editItem?.id ?? generateItemId('sql', trimmedName || 'query'),
		kind: 'sql',
		name: trimmedName || undefined,
		query: { sql: trimmedSql, tableSources },
		chart: chartConfig,
		displayMode,
		rowCap: cap === SQL_SNAPSHOT_ROW_CAP ? undefined : cap,
		snapshot,
		colSpan: editItem?.colSpan
	}
}
