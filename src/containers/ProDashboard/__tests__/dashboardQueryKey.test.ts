import { describe, expect, test } from 'vitest'
import { parseDashboardQueryKey } from '../dashboardQueryKey'

describe('parseDashboardQueryKey', () => {
	test('returns serialized TanStack query-key arrays', () => {
		expect(parseDashboardQueryKey('["pro-dashboard","chart",1]')).toEqual(['pro-dashboard', 'chart', 1])
	})

	test('rejects malformed JSON and non-array JSON values', () => {
		expect(parseDashboardQueryKey('{')).toBeNull()
		expect(parseDashboardQueryKey('{"key":"chart"}')).toBeNull()
	})
})
