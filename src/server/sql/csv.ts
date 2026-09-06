function sanitize(s: string): string {
	return s.replace(/[\r\n]+/g, ' ').trim()
}

export function safeVal(v: unknown): string {
	if (v === null || v === undefined) return ''
	if (typeof v === 'object') {
		if (Array.isArray(v)) return sanitize(v.join(', '))
		return sanitize(JSON.stringify(v))
	}
	return sanitize(String(v))
}

export function escapeCsvField(value: string): string {
	if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
		return `"${value.replace(/"/g, '""')}"`
	}
	return value
}

export function flattenItemsToCsv(items: Array<any>, fields?: Array<string>): string {
	if (items.length === 0) return ''

	let headers: Array<string>

	if (fields && fields.length > 0) {
		headers = fields
	} else {
		const keySet = new Set<string>()
		for (const item of items) {
			if (item && typeof item === 'object' && !Array.isArray(item)) {
				for (const key of Object.keys(item)) {
					keySet.add(key)
				}
			}
		}
		const priorityKeys = ['name', 'displayName']
		headers = [...priorityKeys.filter((k) => keySet.has(k)), ...[...keySet].filter((k) => !priorityKeys.includes(k))]
	}

	const lines = [headers.map(escapeCsvField).join(',')]
	for (const item of items) {
		const row = headers.map((key) => escapeCsvField(safeVal(item?.[key])))
		lines.push(row.join(','))
	}
	return lines.join('\r\n')
}

export function rowsToCsv(rows: Array<Record<string, unknown>>): string {
	if (rows.length === 0) return ''

	const keySet = new Set<string>()
	for (const row of rows) {
		for (const key of Object.keys(row)) {
			keySet.add(key)
		}
	}

	const priorityKeys = ['date']
	const headers = [
		...priorityKeys.filter((k) => keySet.has(k)),
		...[...keySet].filter((k) => !priorityKeys.includes(k))
	]

	const lines = [headers.map(escapeCsvField).join(',')]
	for (const row of rows) {
		const csvRow = headers.map((key) => {
			const val = row[key]
			if (key === 'date' && (typeof val === 'number' || (typeof val === 'string' && /^\d+$/.test(val)))) {
				const num = Number(val)
				const ms = num < 1e12 ? num * 1000 : num
				return escapeCsvField(new Date(ms).toISOString().slice(0, 10))
			}
			return escapeCsvField(safeVal(val))
		})
		lines.push(csvRow.join(','))
	}
	return lines.join('\r\n')
}
