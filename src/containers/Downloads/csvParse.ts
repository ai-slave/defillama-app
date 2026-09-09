export interface ParsedCsvRow {
	id: number
	values: Array<string>
}

export interface ParsedCsv {
	headers: Array<string>
	rows: Array<ParsedCsvRow>
}

export function parseCsvLine(line: string): Array<string> {
	const fields: Array<string> = []
	let i = line.charCodeAt(0) === 0xfe_ff ? 1 : 0
	while (i < line.length) {
		if (line[i] === '"') {
			i++
			let field = ''
			while (i < line.length) {
				if (line[i] === '"' && line[i + 1] === '"') {
					field += '"'
					i += 2
				} else if (line[i] === '"') {
					i++
					break
				} else {
					field += line[i]
					i++
				}
			}
			fields.push(field)
			if (i < line.length && line[i] === ',') i++
		} else {
			let field = ''
			while (i < line.length && line[i] !== ',') {
				field += line[i]
				i++
			}
			fields.push(field)
			if (i < line.length && line[i] === ',') i++
			else break
		}
	}
	if (line.endsWith(',')) fields.push('')
	return fields
}

/** Yield complete records so quoted line breaks never become extra rows. */
export function* csvRecords(text: string): Generator<string> {
	let start = 0
	let quoted = false
	let fieldStart = true
	for (let index = 0; index < text.length; index++) {
		const character = text[index]
		if (quoted) {
			if (character === '"') {
				if (text[index + 1] === '"') index++
				else quoted = false
			}
		} else if (character === '"' && fieldStart) {
			quoted = true
			fieldStart = false
		} else if (character === '\n' || character === '\r') {
			const record = text.slice(start, index)
			if (record.trim()) yield record
			if (character === '\r' && text[index + 1] === '\n') index++
			start = index + 1
			fieldStart = true
		} else if (!(index === 0 && character === '\uFEFF')) {
			fieldStart = character === ','
		}
	}
	const record = text.slice(start)
	if (record.trim()) yield record
}

export function parseCsv(text: string): ParsedCsv {
	const records = csvRecords(text)
	const header = records.next()
	if (header.done) return { headers: [], rows: [] }
	const rows: Array<ParsedCsvRow> = []
	for (const record of records) rows.push({ id: rows.length, values: parseCsvLine(record) })
	return { headers: parseCsvLine(header.value), rows }
}
