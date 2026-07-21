/** Read a numeric value after executor-boundary normalization. */
export function readSqlNumber(value: unknown, allowBoolean = false): number | null {
	if (typeof value === 'number') return Number.isFinite(value) ? value : null
	if (allowBoolean && typeof value === 'boolean') return value ? 1 : 0
	return null
}

/** Read a normalized Unix-millisecond timestamp. */
export function readSqlTimestampMs(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function escapeSqlChartHtml(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
