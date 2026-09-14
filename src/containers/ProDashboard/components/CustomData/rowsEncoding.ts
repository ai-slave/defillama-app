import {
	type CustomDataEncodedRows,
	type CustomDataRows,
	isCustomDataEncodedRows,
	type SqlSnapshotValue
} from '../../types'

export const CUSTOM_DATA_INLINE_ROWS_MAX_LENGTH = 24 * 1024
export const CUSTOM_DATA_ENCODED_MAX_LENGTH = 256 * 1024

function bytesToBase64(bytes: Uint8Array): string {
	let binary = ''
	const chunkSize = 32_768
	for (let index = 0; index < bytes.length; index += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
	}
	return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
	const binary = atob(value)
	const bytes = new Uint8Array(binary.length)
	for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
	return bytes
}

async function pipeThrough(bytes: Uint8Array, transform: CompressionStream | DecompressionStream) {
	const stream = new Blob([bytes as BlobPart])
		.stream()
		.pipeThrough(transform as unknown as ReadableWritablePair<Uint8Array, Uint8Array>)
	return new Uint8Array(await new Response(stream).arrayBuffer())
}

export function supportsRowsCompression(): boolean {
	return typeof CompressionStream === 'function' && typeof DecompressionStream === 'function'
}

export async function gzipBase64Encode(text: string): Promise<string> {
	const compressed = await pipeThrough(new TextEncoder().encode(text), new CompressionStream('gzip'))
	return bytesToBase64(compressed)
}

export async function gzipBase64Decode(value: string): Promise<string> {
	const decompressed = await pipeThrough(base64ToBytes(value), new DecompressionStream('gzip'))
	return new TextDecoder().decode(decompressed)
}

export class CustomDataTooLargeError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'CustomDataTooLargeError'
	}
}

export async function encodeRows(rows: Array<Array<SqlSnapshotValue>>): Promise<CustomDataRows> {
	const json = JSON.stringify(rows)
	if (json.length <= CUSTOM_DATA_INLINE_ROWS_MAX_LENGTH) return rows
	if (!supportsRowsCompression()) {
		throw new CustomDataTooLargeError('This browser cannot compress large datasets. Reduce the CSV to fewer rows.')
	}
	const data = await gzipBase64Encode(json)
	if (data.length > CUSTOM_DATA_ENCODED_MAX_LENGTH) {
		throw new CustomDataTooLargeError('This dataset is too large to store in a dashboard. Remove rows or columns.')
	}
	return { encoding: 'gzip-base64', data, rowCount: rows.length }
}

const decodedRowsCache = new WeakMap<CustomDataEncodedRows, Promise<Array<Array<SqlSnapshotValue>>>>()

function parseDecodedRows(json: string): Array<Array<SqlSnapshotValue>> {
	const parsed: unknown = JSON.parse(json)
	if (!Array.isArray(parsed)) throw new Error('Stored dataset rows are not a list')
	return parsed.filter((row): row is Array<SqlSnapshotValue> => Array.isArray(row))
}

export function decodeRows(rows: CustomDataRows): Promise<Array<Array<SqlSnapshotValue>>> {
	if (!isCustomDataEncodedRows(rows)) return Promise.resolve(rows)
	const cached = decodedRowsCache.get(rows)
	if (cached) return cached
	const pending = gzipBase64Decode(rows.data).then(parseDecodedRows)
	decodedRowsCache.set(rows, pending)
	return pending
}
