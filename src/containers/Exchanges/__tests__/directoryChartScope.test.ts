import { describe, expect, test } from 'vitest'
import { EXCHANGES_QUERY_KEYS, getDirectoryChartIgnoredFilters, segmentQueryValue } from '../queryState'

describe('getDirectoryChartIgnoredFilters', () => {
	test('names the table filters the trading activity chart ignores', () => {
		expect(getDirectoryChartIgnoredFilters({}, null)).toEqual([])
		expect(getDirectoryChartIgnoredFilters({}, 'US')).toEqual(['Country'])
		expect(getDirectoryChartIgnoredFilters({ [EXCHANGES_QUERY_KEYS.directoryKind]: 'dex' }, null)).toEqual(['Venue'])
		expect(
			getDirectoryChartIgnoredFilters(
				{
					[EXCHANGES_QUERY_KEYS.directoryScope]: segmentQueryValue('spot'),
					[EXCHANGES_QUERY_KEYS.directoryKind]: 'cex'
				},
				'DE'
			)
		).toEqual(['Market scope', 'Venue', 'Country'])
	})

	test('ignores the chart’s own segment tab and the column view', () => {
		expect(
			getDirectoryChartIgnoredFilters(
				{
					[EXCHANGES_QUERY_KEYS.directoryChart]: segmentQueryValue('spot'),
					[EXCHANGES_QUERY_KEYS.directoryGroup]: 'fees'
				},
				null
			)
		).toEqual([])
	})
})
