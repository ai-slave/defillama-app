import type { ApiQuery } from '~/server/api/types'
import { parseApyComponents, parseApyWindow } from '../data/query'

// Shared helpers: CSV APY columns mirror the on-screen view — the active window suffixes
// every APY header, and enabled components split each total into its parts.

export function windowSuffix(query: ApiQuery): string {
	const window = parseApyWindow(query)
	return window === 'avg_7d' ? ' (7d)' : window === 'avg_30d' ? ' (30d)' : ''
}

export type CsvSplit = { reward: boolean; intrinsic: boolean }

export function activeSplit(query: ApiQuery): CsvSplit {
	const components = parseApyComponents(query)
	return { reward: components.includes('reward'), intrinsic: components.includes('intrinsic') }
}

export function apyHeaders(label: string, suffix: string, split: CsvSplit, withIntrinsic: boolean): Array<string> {
	if (!split.reward && !split.intrinsic) return [`${label}${suffix}`]
	const headers = [`${label} Base${suffix}`]
	if (split.reward) headers.push(`${label} Reward${suffix}`)
	if (split.intrinsic && withIntrinsic) headers.push(`${label} Intrinsic${suffix}`)
	headers.push(`${label}${suffix}`)
	return headers
}

export function apyValues(
	total: number | null | undefined,
	base: number | null | undefined,
	reward: number | null | undefined,
	intrinsic: number | null | undefined,
	split: CsvSplit,
	withIntrinsic: boolean
): Array<number | null> {
	if (!split.reward && !split.intrinsic) return [total ?? null]
	const values: Array<number | null> = [base ?? null]
	if (split.reward) values.push(reward ?? null)
	if (split.intrinsic && withIntrinsic) values.push(intrinsic ?? null)
	values.push(total ?? null)
	return values
}
