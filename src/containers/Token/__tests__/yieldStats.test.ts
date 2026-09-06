import { describe, expect, test } from 'vitest'
import type { IYieldTableRow } from '~/containers/Yields/Tables/types'
import { getTokenYieldStats } from '../yieldStats'

function row(apy: number | null): IYieldTableRow {
	return { apy } as IYieldTableRow
}

describe('getTokenYieldStats', () => {
	test('preserves the Token page average by excluding zero and missing APYs', () => {
		expect(getTokenYieldStats([row(10), row(0), row(null), row(20)])).toEqual({
			noOfPoolsTracked: 4,
			averageAPY: 15
		})
	})
})
