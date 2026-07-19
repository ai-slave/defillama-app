/** Create a dictionary for API-provided series names without `Object.prototype` key collisions. */
export function createChartRecord<T>(): Record<string, T> {
	return Object.create(null) as Record<string, T>
}

/** Create a canonical time-series row compatible with ECharts' object dataset cloning. */
export function createChartRow<T>(timestamp: number): { timestamp: number } & Record<string, T> {
	return { timestamp } as { timestamp: number } & Record<string, T>
}

/** Preserve external dimension names without triggering Object.prototype's `__proto__` setter. */
export function setChartRowValue<T>(row: Record<string, T>, name: string, value: T) {
	if (name === '__proto__') {
		Object.defineProperty(row, name, { configurable: true, enumerable: true, value, writable: true })
	} else {
		row[name] = value
	}
}
