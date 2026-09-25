import { describe, expect, test } from 'vitest'
import {
	UNKNOWN_BREAKDOWN_LABEL,
	getRWAPerpsBaseAssetBreakdownLabel,
	getRWAPerpsSharedBreakdownLabel,
	normalizeRWAPerpsBreakdownLabel
} from '../breakdownLabels'

const baseRow = {
	contract: 'xyz:META',
	venue: 'xyz',
	referenceAsset: 'Meta',
	referenceAssetGroup: 'Equities',
	assetClass: ['Stock Perp']
}

describe('breakdownLabels', () => {
	test('normalizes empty labels to the shared unknown bucket', () => {
		expect(normalizeRWAPerpsBreakdownLabel('')).toBe(UNKNOWN_BREAKDOWN_LABEL)
		expect(normalizeRWAPerpsBreakdownLabel(null)).toBe(UNKNOWN_BREAKDOWN_LABEL)
		expect(normalizeRWAPerpsBreakdownLabel(undefined)).toBe(UNKNOWN_BREAKDOWN_LABEL)
	})

	test('falls back to the coin suffix when reference asset is missing', () => {
		expect(getRWAPerpsBaseAssetBreakdownLabel({ contract: 'xyz:META', referenceAsset: null })).toBe('META')
	})

	test.each([
		['venue', 'xyz'],
		['assetClass', 'Stock Perp'],
		['baseAsset', 'Meta'],
		['assetGroup', 'Equities'],
		['contract', 'xyz:META']
	] as const)('labels a row by its %s', (breakdown, label) => {
		expect(getRWAPerpsSharedBreakdownLabel(baseRow, breakdown)).toBe(label)
	})
})
