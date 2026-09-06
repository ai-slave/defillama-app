import { describe, expect, test } from 'vitest'
import { getFilteredShareColumnId, getFilteredShareMetricKey } from './filteredShareColumns'

describe('filtered share columns', () => {
	test('round-trips supported semantic metric identifiers', () => {
		const id = getFilteredShareColumnId('fees24h')
		expect(id).toBe('filteredShare_fees24h')
		expect(getFilteredShareMetricKey(id)).toBe('fees24h')
	})

	test('rejects unknown metrics', () => {
		expect(getFilteredShareMetricKey('filteredShare_notAMetric')).toBeNull()
		expect(getFilteredShareMetricKey('fees24h_share')).toBeNull()
	})
})
