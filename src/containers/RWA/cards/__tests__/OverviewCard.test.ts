import { describe, expect, test } from 'vitest'
import { formatRwaBarUsd } from '../OverviewCard'

describe('formatRwaBarUsd', () => {
	test('prints whole dollars under a million and one decimal above', () => {
		expect(formatRwaBarUsd(-871_868.6)).toBe('-$871,869')
		expect(formatRwaBarUsd(973_454)).toBe('+$973,454')
		expect(formatRwaBarUsd(734_900_000)).toBe('+$734.9m')
		expect(formatRwaBarUsd(734_900_000, false)).toBe('$734.9m')
	})
})
