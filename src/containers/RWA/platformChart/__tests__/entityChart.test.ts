import { describe, expect, test } from 'vitest'
import { RWA_VENUE_CHART } from '../../VenuePage/venueChart'
import { getRwaEntityChartMetricsQuery, parseRwaEntityChartMetrics } from '../entityChart'
import { RWA_PLATFORM_CHART } from '../metrics'

describe('the metrics query', () => {
	test('opens with the default alone, reads a comma list, drops unknown keys and keeps the catalogue order', () => {
		expect(parseRwaEntityChartMetrics(RWA_PLATFORM_CHART, undefined)).toEqual(['activeMcap'])
		expect(parseRwaEntityChartMetrics(RWA_PLATFORM_CHART, 'netFlows,activeMcap,nope')).toEqual([
			'activeMcap',
			'netFlows'
		])
		expect(parseRwaEntityChartMetrics(RWA_PLATFORM_CHART, ['events', 'utilization'])).toEqual(['utilization', 'events'])
		expect(parseRwaEntityChartMetrics(RWA_PLATFORM_CHART, 'nope')).toEqual(['activeMcap'])
		expect(parseRwaEntityChartMetrics(RWA_VENUE_CHART, 'events,volume,activeMcap')).toEqual(['volume', 'events'])
	})

	test('writes the selection as a comma list and leaves the default and an empty selection out of the URL', () => {
		expect(getRwaEntityChartMetricsQuery(RWA_PLATFORM_CHART, ['activeMcap'])).toBeUndefined()
		expect(getRwaEntityChartMetricsQuery(RWA_PLATFORM_CHART, [])).toBeUndefined()
		expect(getRwaEntityChartMetricsQuery(RWA_PLATFORM_CHART, ['netFlows', 'activeMcap'])).toBe('activeMcap,netFlows')
		expect(getRwaEntityChartMetricsQuery(RWA_VENUE_CHART, ['openInterest'])).toBeUndefined()
	})
})
