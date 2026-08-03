import type { ChartConfig } from '~/containers/Downloads/sql/chartConfig'
import { extractTableRefs } from '~/containers/Downloads/sql/completions'
import type { QueryResult } from '~/containers/Downloads/sql/exportResults'
import type { RegisteredTable } from '~/containers/Downloads/sql/useTableRegistry'
import { captureSnapshot, clampRowCap, SQL_SNAPSHOT_ROW_CAP } from '../../sqlSnapshot'
import type { SqlChartConfig } from '../../types'
import { generateItemId } from '../../utils/dashboardUtils'

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
	const config: SqlChartConfig = {
		id: editItem?.id ?? generateItemId('sql', trimmedName || 'query'),
		kind: 'sql',
		query: { sql: trimmedSql, tableSources },
		chart: chartConfig,
		displayMode,
		snapshot
	}
	if (trimmedName) config.name = trimmedName
	if (cap !== SQL_SNAPSHOT_ROW_CAP) config.rowCap = cap
	if (editItem?.colSpan !== undefined) config.colSpan = editItem.colSpan
	return config
}
