import { describe, expect, test } from 'vitest'
import { dexAggregatorIntro, dexVolumeIntro, perpIntro } from '../hubCopy'

const DATE = Date.UTC(2026, 9, 14) / 1000

describe('adapter hub intros', () => {
	test('names the three largest aggregator volumes', () => {
		expect(
			dexAggregatorIntro({
				dateSec: DATE,
				total24h: 2.46e9,
				protocols: [
					{ name: '0x', total24h: 207e6 },
					{ name: 'DFlow', total24h: 349e6 },
					{ name: 'Jupiter', total24h: 539e6 },
					{ name: 'Empty', total24h: null }
				]
			})
		).toEqual({
			intro:
				'A DEX aggregator routes swaps across exchanges for a better price. On Oct 14, 2026, tracked DEX aggregator volume was $2.46b in 24 hours. Jupiter led at $539m, then DFlow at $349m and 0x at $207m.',
			volumeAnswer:
				'On Oct 14, 2026, tracked DEX aggregator volume was $2.46b in 24 hours. Jupiter led at $539m, then DFlow at $349m and 0x at $207m.'
		})
	})

	test('keeps the aggregator definition when the top three are missing', () => {
		expect(dexAggregatorIntro({ dateSec: DATE, total24h: null, protocols: [] })).toEqual({
			intro: 'A DEX aggregator routes swaps across exchanges for a better price.',
			volumeAnswer: null
		})
	})

	test('names the perp volume leader', () => {
		expect(
			perpIntro({
				dateSec: DATE,
				protocols: [
					{ name: 'Lighter', total24h: 1e9 },
					{ name: 'Hyperliquid', total24h: 4e9 }
				]
			})
		).toBe('A perpetual DEX lists perpetual futures markets. On Oct 14, 2026 Hyperliquid led 24h volume at $4b.')
	})

	test('names the three largest DEX volumes', () => {
		expect(
			dexVolumeIntro({
				dateSec: DATE,
				protocols: [
					{ name: 'Aerodrome', total24h: 1e9 },
					{ name: 'PancakeSwap', total24h: 2e9 },
					{ name: 'Uniswap', total24h: 3e9 }
				]
			})
		).toBe('On Oct 14, 2026 Uniswap led DEX volume at $3b, ahead of PancakeSwap and Aerodrome.')
	})
})
