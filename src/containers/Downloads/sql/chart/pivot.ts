import { readSqlNumber } from './rowValues'

export interface PivotOptions {
	topN?: number
	otherLabel?: string
}

export interface PivotResult {
	keys: Array<string>
	rows: Array<Array<number | string | null>>
	truncatedCount: number
}

function splitKey(v: unknown): string {
	if (v == null) return '∅'
	if (typeof v === 'string') return v
	return String(v)
}

export function pivotRowsForSplit(
	rows: Array<Array<unknown>>,
	xIndex: number,
	yIndex: number,
	splitIndex: number,
	opts: PivotOptions = {}
): PivotResult {
	const topN = opts.topN ?? 20
	const otherLabel = opts.otherLabel ?? 'Other'

	const magnitudeByKey = new Map<string, number>()
	for (const row of rows) {
		const key = splitKey(row[splitIndex])
		const yn = readSqlNumber(row[yIndex])
		if (yn == null) continue
		magnitudeByKey.set(key, (magnitudeByKey.get(key) ?? 0) + Math.abs(yn))
	}

	const ranked = [...magnitudeByKey.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k)
	const topKeys = ranked.slice(0, topN)
	const truncated = ranked.slice(topN)
	const truncatedSet = new Set(truncated)
	const hasOther = truncated.length > 0
	const keys = hasOther && !topKeys.includes(otherLabel) ? [...topKeys, otherLabel] : [...topKeys]

	const seriesIndexByKey = new Map<string, number>()
	for (let i = 0; i < keys.length; i++) seriesIndexByKey.set(keys[i], i + 1)
	const byX = new Map<string | number, Array<number | string | null>>()
	for (const row of rows) {
		const xv = row[xIndex]
		const mapKey = typeof xv === 'number' ? xv : xv == null ? '∅' : String(xv)
		let bucket = byX.get(mapKey)
		if (!bucket) {
			bucket = new Array<number | string | null>(keys.length + 1).fill(null)
			bucket[0] = (xv as number | string | null) ?? null
			byX.set(mapKey, bucket)
		}
		const sk = splitKey(row[splitIndex])
		const target = truncatedSet.has(sk) ? otherLabel : topKeys.includes(sk) ? sk : null
		if (target == null) continue
		const yn = readSqlNumber(row[yIndex])
		if (yn == null) continue
		const targetIndex = seriesIndexByKey.get(target)!
		bucket[targetIndex] = ((bucket[targetIndex] as number | null) ?? 0) + yn
	}

	const sortedX = [...byX.values()].sort((a, b) => compareX(a[0], b[0]))

	return { keys, rows: sortedX, truncatedCount: truncated.length }
}

function compareX(a: unknown, b: unknown): number {
	if (typeof a === 'number' && typeof b === 'number') return a - b
	const as = a == null ? '' : String(a)
	const bs = b == null ? '' : String(b)
	return as < bs ? -1 : as > bs ? 1 : 0
}
