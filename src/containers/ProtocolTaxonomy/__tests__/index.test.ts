import { describe, expect, test } from 'vitest'
import { getProtocolMcapTvlRatio } from '../index'

describe('getProtocolMcapTvlRatio', () => {
	test('requires positive TVL for market-cap ratios while preserving zero market cap', () => {
		expect(getProtocolMcapTvlRatio(0, 10)).toBe(0)
		expect(getProtocolMcapTvlRatio(10, 0)).toBeUndefined()
		expect(getProtocolMcapTvlRatio(10, null)).toBeUndefined()
	})
})
