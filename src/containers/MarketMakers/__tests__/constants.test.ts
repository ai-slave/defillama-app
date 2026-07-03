import { describe, expect, it } from 'vitest'
import { DISPLAY_MODES, selectCellNumber, VOLUME_COLUMNS } from '../constants'

describe('selectCellNumber', () => {
	const metric = { value: 1000, percentile: 80, rank: 3 }
	it('returns the field matching the active mode', () => {
		expect(selectCellNumber(metric, 'value')).toBe(1000)
		expect(selectCellNumber(metric, 'percentile')).toBe(80)
		expect(selectCellNumber(metric, 'rank')).toBe(3)
	})
	it('returns null for a missing metric', () => {
		expect(selectCellNumber(null, 'value')).toBeNull()
	})
})

describe('column configs', () => {
	it('exposes the three display modes', () => {
		expect(DISPLAY_MODES).toEqual(['value', 'percentile', 'rank'])
	})
	it('declares volume columns with a market-share twin where applicable', () => {
		const total = VOLUME_COLUMNS.find((c) => c.metricKey === 'orderFillVolumeTotal')
		expect(total?.marketKey).toBe('orderFillVolumeTotalMarketPercentage')
		expect(total?.kind).toBe('usd')
	})
})
