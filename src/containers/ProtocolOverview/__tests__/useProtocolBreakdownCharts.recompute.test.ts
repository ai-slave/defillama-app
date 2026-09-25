import { expect, test } from 'vitest'
import { getBreakdownComputeSignature, selectComputableCharts } from '../useProtocolBreakdownCharts'

const chart: Array<[number, number]> = [
	[1000, 10],
	[2000, 20]
]

test('keeps cached data through a failed refetch but drops a source that failed without data', () => {
	expect(selectComputableCharts([{ data: chart, dataUpdatedAt: 1, isError: true }])).toEqual([chart])
	expect(
		selectComputableCharts([
			{ data: chart, dataUpdatedAt: 1, isError: false },
			{ data: undefined, dataUpdatedAt: 0, isError: true }
		])
	).toEqual([])
	expect(selectComputableCharts([{ data: undefined, dataUpdatedAt: 0, isError: false }])).toEqual([undefined])
})

function signature(query: { data: unknown; dataUpdatedAt: number; isError: boolean }, tokensToExclude?: Array<string>) {
	return getBreakdownComputeSignature({
		queryGroups: [[query], [], [], []],
		protocol: 'test-protocol',
		source: 'tvl',
		includeBase: true,
		keys: [],
		tokensToExclude,
		inflows: false,
		computeInflows: false,
		tokenPieMinimumValue: 1
	})
}

test('recomputes when data arrives, updates or goes away, but not on an error alone', () => {
	const loaded = signature({ data: chart, dataUpdatedAt: 1, isError: false })
	expect(signature({ data: chart, dataUpdatedAt: 1, isError: true })).toBe(loaded)
	expect(signature({ data: chart, dataUpdatedAt: 2, isError: false })).not.toBe(loaded)
	expect(signature({ data: undefined, dataUpdatedAt: 1, isError: false })).not.toBe(loaded)
})

test('recomputes when the canonical token exclusions change, not when they are only repeated', () => {
	const query = { data: chart, dataUpdatedAt: 1, isError: false }
	expect(signature(query, ['GT'])).not.toBe(signature(query))
	expect(signature(query, ['GT', 'GT'])).toBe(signature(query, ['GT']))
	expect(signature(query, ['A', 'B'])).toBe(signature(query, ['B', 'A']))
})
