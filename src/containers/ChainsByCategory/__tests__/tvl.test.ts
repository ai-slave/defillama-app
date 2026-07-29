import { describe, expect, it } from 'vitest'
import {
	applyChainsTvlSettings,
	getChainMcapTvlRatio,
	normalizeChainsBaseTvlValue,
	removeStaleChainExtraTvlEntries
} from '../tvl'

describe('chains by category tvl helpers', () => {
	it('returns only finite market-cap ratios while preserving an explicit zero market cap', () => {
		expect(getChainMcapTvlRatio(0, 100)).toBe(0)
		expect(getChainMcapTvlRatio(100, 0)).toBeNull()
		expect(getChainMcapTvlRatio(100, null)).toBeNull()
		expect(getChainMcapTvlRatio(null, 100)).toBeNull()
	})

	it('subtracts current doublecounted and liquid staking tvl by default', () => {
		const normalized = normalizeChainsBaseTvlValue(106_854_312_810, {
			doublecounted: 47_590_610_833,
			liquidstaking: 34_794_501_734,
			dcAndLsOverlap: 21_963_362_717
		})

		expect(normalized).toBe(46_432_562_960)
	})

	it('normalizes cosmoshub default tvl after stale doublecounted entries are removed', () => {
		const sanitized = removeStaleChainExtraTvlEntries({
			chainName: 'CosmosHub',
			extraTvl: {
				doublecounted: {
					tvl: 2_170_124,
					tvlPrevDay: 0,
					tvlPrevWeek: 0,
					tvlPrevMonth: 0
				},
				liquidstaking: {
					tvl: 6_085_010,
					tvlPrevDay: 6_085_010,
					tvlPrevWeek: 6_085_010,
					tvlPrevMonth: 6_085_010
				}
			},
			tvlChartsByChain: {
				tvl: {
					CosmosHub: {
						1776643200000: 6_224_100
					}
				},
				doublecounted: {
					CosmosHub: {
						1736467200000: 2_170_124
					}
				},
				liquidstaking: {
					CosmosHub: {
						1776643200000: 6_085_010
					}
				}
			}
		})

		const normalized = normalizeChainsBaseTvlValue(6_224_100, {
			...(sanitized.doublecounted ? { doublecounted: sanitized.doublecounted.tvl } : {}),
			liquidstaking: 6_085_010,
			dcAndLsOverlap: sanitized.dcAndLsOverlap?.tvl ?? 0
		})

		expect(normalized).toBe(139_090)
	})

	it('normalizes celestia default tvl to zero when base equals liquid staking tvl', () => {
		const normalized = normalizeChainsBaseTvlValue(298_257, {
			liquidstaking: 298_257,
			dcAndLsOverlap: 0
		})

		expect(normalized).toBe(0)
	})

	it('clamps the final independently rounded value without losing exact extra tvl restoration', () => {
		const doublecounted = 502_682
		const liquidstaking = 1_499_449
		const normalized = normalizeChainsBaseTvlValue(2_002_130, { doublecounted, liquidstaking })

		expect(normalized).toBe(-1)
		expect(applyChainsTvlSettings(normalized, {}, [])).toBe(0)
		expect(applyChainsTvlSettings(normalized, { doublecounted }, ['doublecounted'])).toBe(502_681)
		expect(
			applyChainsTvlSettings(normalized, { doublecounted, liquidstaking }, ['doublecounted', 'liquidstaking'])
		).toBe(2_002_130)

		const persistentResidual = normalizeChainsBaseTvlValue(1_272_372, {
			liquidstaking: 1_027_410,
			doublecounted: 244_963
		})
		expect(applyChainsTvlSettings(persistentResidual, {}, [])).toBe(0)
	})

	it('keeps rows and charts consistent when both doublecounted and liquidstaking are enabled', () => {
		const normalized = normalizeChainsBaseTvlValue(150, {
			doublecounted: 30,
			liquidstaking: 60,
			dcAndLsOverlap: 10
		})

		expect(normalized).toBe(70)
		expect(applyChainsTvlSettings(normalized, { doublecounted: 30 }, ['doublecounted'])).toBe(100)
		expect(applyChainsTvlSettings(normalized, { liquidstaking: 60 }, ['liquidstaking'])).toBe(130)
		expect(
			applyChainsTvlSettings(normalized, { doublecounted: 30, liquidstaking: 60, dcAndLsOverlap: 10 }, [
				'doublecounted',
				'liquidstaking'
			])
		).toBe(150)
	})

	it('returns null when no base or enabled extra tvl data exists', () => {
		expect(applyChainsTvlSettings(undefined, {}, ['doublecounted'])).toBeNull()
	})

	it('distinguishes an absent selected family from a present family with a null snapshot', () => {
		expect(applyChainsTvlSettings(100, {}, ['staking'])).toBe(100)
		expect(applyChainsTvlSettings(100, { staking: null }, ['staking'])).toBeNull()
		expect(applyChainsTvlSettings(90, { staking: 10 }, ['staking'])).toBe(100)
	})

	it('requires a known overlap when both overlapping families are selected', () => {
		expect(
			applyChainsTvlSettings(50, { doublecounted: 20, liquidstaking: 30, dcAndLsOverlap: null }, [
				'doublecounted',
				'liquidstaking'
			])
		).toBeNull()
		expect(normalizeChainsBaseTvlValue(100, { doublecounted: null })).toBeNull()
		expect(normalizeChainsBaseTvlValue(100, {})).toBe(100)
	})

	it('drops stale doublecounted snapshot entries when the chart series stopped updating', () => {
		const sanitized = removeStaleChainExtraTvlEntries({
			chainName: 'CosmosHub',
			extraTvl: {
				doublecounted: {
					tvl: 2_170_124,
					tvlPrevDay: 2_170_124,
					tvlPrevWeek: 2_170_124,
					tvlPrevMonth: 2_170_124
				},
				liquidstaking: {
					tvl: 6_085_010,
					tvlPrevDay: 6_085_010,
					tvlPrevWeek: 6_085_010,
					tvlPrevMonth: 6_085_010
				}
			},
			tvlChartsByChain: {
				tvl: {
					CosmosHub: {
						1776643200000: 6_224_100
					}
				},
				doublecounted: {
					CosmosHub: {
						1736467200000: 2_170_124
					}
				},
				liquidstaking: {
					CosmosHub: {
						1776643200000: 6_085_010
					}
				}
			}
		})

		expect(sanitized.doublecounted).toBeUndefined()
		expect(sanitized.liquidstaking?.tvl).toBe(6_085_010)
		expect(sanitized.dcAndLsOverlap).toBeUndefined()
	})

	it('preserves non-chart extra tvl entries while sanitizing stale chart-backed entries', () => {
		const sanitized = removeStaleChainExtraTvlEntries({
			chainName: 'Ethereum',
			extraTvl: {
				excludeparent: {
					tvl: 123,
					tvlPrevDay: 120,
					tvlPrevWeek: 110,
					tvlPrevMonth: 100
				}
			},
			tvlChartsByChain: {
				tvl: {
					Ethereum: {
						1776643200000: 106_854_312_810
					}
				}
			}
		})

		expect(sanitized.excludeparent?.tvl).toBe(123)
	})

	it('keeps an extra TVL snapshot at the exact stale tolerance boundary', () => {
		const latestBaseTimestamp = 1_800_000_000_000
		const latestExtraTimestamp = latestBaseTimestamp - 2 * 24 * 60 * 60 * 1000
		const sanitized = removeStaleChainExtraTvlEntries({
			chainName: 'Boundary',
			extraTvl: {
				staking: { tvl: 5, tvlPrevDay: 4, tvlPrevWeek: 3, tvlPrevMonth: 2 }
			},
			tvlChartsByChain: {
				tvl: { Boundary: { [latestBaseTimestamp]: 100 } },
				staking: { Boundary: { [latestExtraTimestamp]: 5 } }
			}
		})

		expect(sanitized.staking?.tvl).toBe(5)
	})

	it('preserves dynamic keys while filtering only chart-backed families', () => {
		const latestBaseTimestamp = 1_800_000_000_000
		const extraTvl = {
			offers: { tvl: 7, tvlPrevDay: null, tvlPrevWeek: null, tvlPrevMonth: null },
			custom: { tvl: 8, tvlPrevDay: null, tvlPrevWeek: null, tvlPrevMonth: null }
		}

		const sanitized = removeStaleChainExtraTvlEntries({
			chainName: 'Special',
			extraTvl,
			tvlChartsByChain: {
				tvl: { Special: { [latestBaseTimestamp]: 100 } },
				offers: { Special: { [latestBaseTimestamp]: 7 } }
			}
		})

		expect(sanitized.offers?.tvl).toBe(7)
		expect(sanitized.custom?.tvl).toBe(8)
	})

	it('drops overlap when either required chart-backed snapshot is stale', () => {
		const sanitized = removeStaleChainExtraTvlEntries({
			chainName: 'Overlap',
			extraTvl: {
				doublecounted: { tvl: 20, tvlPrevDay: 20, tvlPrevWeek: 20, tvlPrevMonth: 20 },
				liquidstaking: { tvl: 30, tvlPrevDay: 30, tvlPrevWeek: 30, tvlPrevMonth: 30 },
				dcAndLsOverlap: { tvl: 10, tvlPrevDay: 10, tvlPrevWeek: 10, tvlPrevMonth: 10 }
			},
			tvlChartsByChain: {
				tvl: { Overlap: { 1_800_000_000_000: 100 } },
				doublecounted: { Overlap: { 1_700_000_000_000: 20 } },
				liquidstaking: { Overlap: { 1_800_000_000_000: 30 } },
				dcAndLsOverlap: { Overlap: { 1_800_000_000_000: 10 } }
			}
		})

		expect(sanitized.doublecounted).toBeUndefined()
		expect(sanitized.liquidstaking?.tvl).toBe(30)
		expect(sanitized.dcAndLsOverlap).toBeUndefined()
	})
})
