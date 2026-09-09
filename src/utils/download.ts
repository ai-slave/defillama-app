import { trackUmamiEvent } from './analytics/umami'
import { serializeCsv, type CsvData, type CsvSerializableCell } from './csv'

export interface CSVDownloadOptions {
	mimeType?: string
	addTimestamp?: boolean
}

export interface DatasetCSVParams {
	data: Array<Record<string, unknown>>
	columns?: Array<string>
	columnHeaders?: Record<string, string>
	filename?: string
	filenameSuffix?: string
	addTimestamp?: boolean
}

export function download(filename: string, text: string): void {
	const element = document.createElement('a')
	element.setAttribute('href', `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`)
	element.setAttribute('download', filename)

	element.style.display = 'none'
	document.body.appendChild(element)

	element.click()

	document.body.removeChild(element)
}

export function downloadDataURL(filename: string, dataURL: string): void {
	const element = document.createElement('a')
	element.setAttribute('href', dataURL)
	element.setAttribute('download', filename)

	element.style.display = 'none'
	document.body.appendChild(element)

	element.click()

	document.body.removeChild(element)
}

export function downloadBlob(filename: string, blob: Blob): void {
	const downloadUrl = window.URL.createObjectURL(blob)
	const link = document.createElement('a')
	link.href = downloadUrl
	link.download = filename
	link.style.display = 'none'

	document.body.appendChild(link)
	link.click()
	document.body.removeChild(link)
	window.URL.revokeObjectURL(downloadUrl)
}

function stringifyCell(cell: CsvSerializableCell): string {
	if (cell == null) return ''
	if (typeof cell === 'object') return JSON.stringify(cell)
	return String(cell)
}

export function addTimestampToFilename(filename: string, date: string): string {
	if (filename.includes(date)) return filename

	const extensionIndex = filename.lastIndexOf('.')
	if (extensionIndex <= 0 || extensionIndex === filename.length - 1) return `${filename}_${date}`

	return `${filename.slice(0, extensionIndex)}_${date}${filename.slice(extensionIndex)}`
}

export function downloadJSON(
	filename: string,
	data: Array<Array<CsvSerializableCell>>,
	options: { addTimestamp?: boolean } = {}
): void {
	try {
		const [header, ...rows] = data
		if (!header) {
			download(filename, '[]')
			return
		}
		const headerStrings = header.map(stringifyCell)
		const objects = rows.map((row) => {
			const obj: Record<string, string> = {}
			for (const [index, headerName] of headerStrings.entries()) {
				obj[headerName] = stringifyCell(row[index])
			}
			return obj
		})
		const content = JSON.stringify(objects, null, 2)

		trackUmamiEvent('export-json-success', { filename })

		const finalFilename = options.addTimestamp
			? addTimestampToFilename(filename, new Date().toISOString().slice(0, 10))
			: filename

		downloadBlob(finalFilename, new Blob([content], { type: 'application/json;charset=utf-8;' }))
	} catch (error) {
		console.log('JSON download error:', error)
	}
}

export type DownloadFormat = 'csv' | 'json'

export function downloadTabular(
	format: DownloadFormat,
	filename: string,
	data: Array<Array<CsvSerializableCell>>,
	options: { addTimestamp?: boolean } = {}
): void {
	const base = filename.replace(/\.(csv|json)$/i, '')
	if (format === 'json') {
		downloadJSON(`${base}.json`, data, options)
	} else {
		downloadCSV(`${base}.csv`, data, options)
	}
}

export function downloadCSV(filename: string, csvData: CsvData, options: CSVDownloadOptions = {}): void {
	const csvContent = serializeCsv(csvData)
	const { mimeType = 'text/csv;charset=utf-8;', addTimestamp = false } = options
	const finalFilename = addTimestamp
		? addTimestampToFilename(filename, new Date().toISOString().slice(0, 10))
		: filename

	try {
		trackUmamiEvent('export-csv-success', { filename })

		downloadBlob(finalFilename, new Blob([csvContent], { type: mimeType }))
	} catch (error) {
		console.log('CSV download error:', error)
		download(finalFilename, csvContent)
	}
}
