import { describe, expect, it } from 'vitest'
import { getFilteredShareColumnId, getFilteredShareMetricKey } from './filteredShareColumns'

describe('filtered share columns', () => {
	it('round-trips supported semantic metric identifiers', () => {
		const id = getFilteredShareColumnId('fees24h')
		expect(id).toBe('filteredShare_fees24h')
		expect(getFilteredShareMetricKey(id)).toBe('fees24h')
	})

	it('rejects unknown metrics', () => {
		expect(getFilteredShareMetricKey('filteredShare_notAMetric')).toBeNull()
		expect(getFilteredShareMetricKey('fees24h_share')).toBeNull()
	})
})
