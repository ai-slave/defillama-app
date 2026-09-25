import { describe, expect, test } from 'vitest'
import type { IProtocol } from '~/containers/ProtocolRankings/types'
import type { ProtocolLiteTvlEntry } from '../api.types'
import type { IRecentProtocol } from '../types'
import { applyExtraTvl, applyProtocolTvlSettings, scopeRecentProtocolToChains } from '../utils'

type ProtocolTvlRecord = NonNullable<IProtocol['tvl']>
type ProtocolTvlEntry = ProtocolTvlRecord['default']

const makeTvlEntry = (
	tvl: number | null,
	tvlPrevDay: number | null = tvl,
	tvlPrevWeek: number | null = tvl,
	tvlPrevMonth: number | null = tvl
): ProtocolLiteTvlEntry => ({
	tvl,
	tvlPrevDay,
	tvlPrevWeek,
	tvlPrevMonth
})

const makeProtocolTvl = (overrides: Partial<ProtocolTvlRecord> = {}): ProtocolTvlRecord => ({
	default: makeTvlEntry(100, 80, 50, 25),
	pool2: makeTvlEntry(0),
	staking: makeTvlEntry(0),
	borrowed: makeTvlEntry(0),
	doublecounted: makeTvlEntry(0),
	liquidstaking: makeTvlEntry(0),
	vesting: makeTvlEntry(0),
	excludeParent: makeTvlEntry(0),
	...overrides
})

const makeProtocol = (overrides: Partial<IProtocol> = {}): IProtocol => ({
	name: 'Example Protocol',
	slug: 'example-protocol',
	category: 'Dexes',
	tvl: makeProtocolTvl(),
	tvlChange: null,
	chains: ['Ethereum'],
	mcap: 1000,
	tokenPrice: null,
	mcaptvl: null,
	strikeTvl: false,
	...overrides
})

const makeRecentProtocol = (overrides: Partial<IRecentProtocol> = {}): IRecentProtocol => ({
	name: 'Recent Protocol',
	symbol: 'RECENT',
	logo: '',
	url: 'https://example.com',
	category: 'Dexes',
	chains: ['Ethereum'],
	chainTvls: {},
	tvl: 100,
	tvlPrevDay: 80,
	tvlPrevWeek: 50,
	tvlPrevMonth: 25,
	mcap: 1000,
	listedAt: 1_700_000_000,
	defillamaId: 'recent-protocol',
	extraTvl: {},
	...overrides
})

function only<T>(values: Array<T>): T {
	const value = values[0]
	if (value === undefined) throw new Error('Expected one result')
	return value
}

describe('ProtocolLists TVL helpers', () => {
	test('keeps selected-chain previous snapshots unknown when one required chain snapshot is null', () => {
		const protocol = scopeRecentProtocolToChains({
			protocol: makeRecentProtocol({
				chains: ['OP Mainnet', 'Base'],
				chainTvls: {
					'OP Mainnet': makeTvlEntry(100, 80, 70, 60),
					Base: makeTvlEntry(50, null, 40, 30)
				}
			}),
			selectedChains: new Set(['op mainnet', 'base'])
		})

		expect(protocol.tvl).toBe(150)
		expect(protocol.tvlPrevDay).toBeNull()
		expect(protocol.tvlPrevWeek).toBe(110)
		expect(protocol.tvlPrevMonth).toBe(90)
	})

	test('keeps selected-chain current TVL unknown when a present contribution is null', () => {
		const protocol = scopeRecentProtocolToChains({
			protocol: makeRecentProtocol({
				chains: ['OP Mainnet', 'Base'],
				chainTvls: {
					'OP Mainnet': makeTvlEntry(100),
					Base: makeTvlEntry(null)
				}
			}),
			selectedChains: new Set(['op mainnet', 'base'])
		})

		expect(protocol.tvl).toBeNull()
	})

	test('keeps combined snapshots unknown when a selected declared chain has no base entry', () => {
		const protocol = scopeRecentProtocolToChains({
			protocol: makeRecentProtocol({
				chains: ['Ethereum', 'Base'],
				chainTvls: {
					Ethereum: makeTvlEntry(100, 80, 70, 60),
					'Base-staking': makeTvlEntry(10, 9, 8, 7)
				}
			}),
			selectedChains: new Set(['ethereum', 'base', 'arbitrum'])
		})

		expect(protocol).toMatchObject({
			tvl: null,
			tvlPrevDay: null,
			tvlPrevWeek: null,
			tvlPrevMonth: null,
			extraTvl: { staking: makeTvlEntry(10, 9, 8, 7) }
		})
	})

	test('distinguishes a sole null, explicit zero, and missing selected-chain base', () => {
		const protocol = makeRecentProtocol({
			chains: ['Ethereum'],
			chainTvls: { Ethereum: makeTvlEntry(null) }
		})

		expect(scopeRecentProtocolToChains({ protocol, selectedChains: new Set(['ethereum']) }).tvl).toBeNull()
		expect(
			scopeRecentProtocolToChains({
				protocol: { ...protocol, chainTvls: { Ethereum: makeTvlEntry(0) } },
				selectedChains: new Set(['ethereum'])
			}).tvl
		).toBe(0)
		expect(scopeRecentProtocolToChains({ protocol, selectedChains: new Set(['base']) }).tvl).toBeNull()
	})

	test('preserves selected-chain zero snapshots and admits only producer-backed protocol extras', () => {
		const protocol = scopeRecentProtocolToChains({
			protocol: makeRecentProtocol({
				chains: ['OP Mainnet'],
				chainTvls: {
					'OP Mainnet': makeTvlEntry(0, 0, 0, 0),
					'OP Mainnet-staking': makeTvlEntry(10, null, 8, 7),
					'OP Mainnet-doublecounted': makeTvlEntry(20)
				}
			}),
			selectedChains: new Set(['op mainnet'])
		})

		expect(protocol.tvl).toBe(0)
		expect(protocol.tvlPrevDay).toBe(0)
		expect(protocol.extraTvl).toEqual({
			staking: makeTvlEntry(10, null, 8, 7)
		})
	})

	test('keeps nullable enabled extra snapshots unknown while persisted govtokens state is a no-op', () => {
		const protocol = only(
			applyExtraTvl(
				[
					makeRecentProtocol({
						extraTvl: {
							staking: makeTvlEntry(20, null, 10, null)
						}
					})
				],
				{ staking: true, govtokens: true }
			)
		)

		expect(protocol.tvl).toBe(120)
		expect(protocol.tvlPrevDay).toBeNull()
		expect(protocol.tvlPrevWeek).toBe(60)
		expect(protocol.tvlPrevMonth).toBeNull()
		expect(protocol.change_1d).toBeNull()
	})

	test('adds enabled staking but never persisted govtokens TVL to protocol table rows', () => {
		// govtokens is a retired setting that can still be persisted; the API may still ship its entry.
		const tvl = { ...makeProtocolTvl({ staking: makeTvlEntry(20) }), govtokens: makeTvlEntry(50) } as ProtocolTvlRecord

		const [protocol] = applyProtocolTvlSettings({
			protocols: [makeProtocol({ tvl })],
			extraTvlsEnabled: { staking: true, govtokens: true },
			minTvl: null,
			maxTvl: null
		})

		expect(protocol?.tvl?.default.tvl).toBe(120)
	})

	test('adds enabled recent protocol extras while persisted classification settings are no-ops', () => {
		const [protocol] = applyExtraTvl(
			[
				makeRecentProtocol({
					extraTvl: {
						staking: makeTvlEntry(20)
					}
				})
			],
			{ staking: true, doublecounted: true, liquidstaking: true }
		)
		if (!protocol) throw new Error('Expected adjusted protocol')

		expect(protocol.tvl).toBe(120)
		expect(protocol.tvlPrevDay).toBe(100)
		expect(protocol.tvlPrevWeek).toBe(70)
		expect(protocol.tvlPrevMonth).toBe(45)
		expect(protocol.change_1d).toBe(20)
		expect(protocol.mcaptvl).toBeCloseTo(1000 / 120)
	})

	test('clamps negative recent protocol TVL values after enabled extras are applied', () => {
		const [protocol] = applyExtraTvl(
			[
				makeRecentProtocol({
					tvl: 10,
					tvlPrevDay: 8,
					tvlPrevWeek: 6,
					tvlPrevMonth: 4,
					extraTvl: {
						pool2: makeTvlEntry(-50, -40, -30, -20)
					}
				})
			],
			{ pool2: true }
		)
		if (!protocol) throw new Error('Expected adjusted protocol')

		expect(protocol.tvl).toBe(0)
		expect(protocol.tvlPrevDay).toBe(0)
		expect(protocol.tvlPrevWeek).toBe(0)
		expect(protocol.tvlPrevMonth).toBe(0)
		expect(protocol.change_1d).toBeNull()
		expect(protocol.mcaptvl).toBeNull()
	})

	test('adds normal protocol table extras while keeping doublecounted and liquid staking non-additive', () => {
		const [protocol] = applyProtocolTvlSettings({
			protocols: [
				makeProtocol({
					strikeTvl: true,
					tvl: makeProtocolTvl({
						default: makeTvlEntry(100, 80, 50, 25),
						staking: makeTvlEntry(20),
						doublecounted: makeTvlEntry(500),
						liquidstaking: makeTvlEntry(600)
					})
				})
			],
			extraTvlsEnabled: { staking: true, doublecounted: true, liquidstaking: true },
			minTvl: null,
			maxTvl: null
		})
		if (!protocol) throw new Error('Expected adjusted protocol')

		expect(protocol.strikeTvl).toBe(true)
		expect(protocol.tvl?.default).toEqual(makeTvlEntry(120, 100, 70, 45))
		expect(protocol.tvlChange?.change1d).toBe(20)
		expect(protocol.mcaptvl).toBeCloseTo(1000 / 120)
	})

	test('keeps market-cap ratios finite with positive denominators and preserves a zero numerator', () => {
		const [zeroMcap, negativeTvl] = applyProtocolTvlSettings({
			protocols: [
				makeProtocol({ mcap: 0, tvl: makeProtocolTvl({ default: makeTvlEntry(100) }) }),
				makeProtocol({ name: 'Negative TVL', mcap: 100, tvl: makeProtocolTvl({ default: makeTvlEntry(-10) }) })
			],
			extraTvlsEnabled: { staking: true },
			minTvl: null,
			maxTvl: null
		})

		expect(zeroMcap?.mcaptvl).toBe(0)
		expect(negativeTvl?.mcaptvl).toBeNull()
	})

	test('excludes unavailable TVL whenever a numeric min or max bound is active', () => {
		const protocols = [
			makeProtocol({ name: 'Unavailable', tvl: makeProtocolTvl({ default: makeTvlEntry(null) }) }),
			makeProtocol({ name: 'Zero', tvl: makeProtocolTvl({ default: makeTvlEntry(0) }) }),
			makeProtocol({ name: 'Positive', tvl: makeProtocolTvl({ default: makeTvlEntry(100) }) })
		]

		expect(
			applyProtocolTvlSettings({ protocols, extraTvlsEnabled: {}, minTvl: 0, maxTvl: null }).map(
				(protocol) => protocol.name
			)
		).toEqual(['Zero', 'Positive'])
		expect(
			applyProtocolTvlSettings({ protocols, extraTvlsEnabled: {}, minTvl: null, maxTvl: 100 }).map(
				(protocol) => protocol.name
			)
		).toEqual(['Zero', 'Positive'])
	})

	test('keeps nullable additive extra fields unknown when protocol table base fields exist', () => {
		const staking = {
			tvl: 20,
			tvlPrevDay: null,
			tvlPrevWeek: 10,
			tvlPrevMonth: null
		} satisfies ProtocolTvlEntry

		const [protocol] = applyProtocolTvlSettings({
			protocols: [
				makeProtocol({
					tvl: makeProtocolTvl({
						default: makeTvlEntry(100, 80, 50, 25),
						staking
					})
				})
			],
			extraTvlsEnabled: { staking: true },
			minTvl: null,
			maxTvl: null
		})
		if (!protocol) throw new Error('Expected adjusted protocol')

		expect(protocol.tvl?.default).toEqual(makeTvlEntry(120, null, 60, null))
	})

	test('keeps unknown protocol table base fields unknown even when additive extras exist', () => {
		const defaultTvl = {
			tvl: 100,
			tvlPrevDay: null,
			tvlPrevWeek: 50,
			tvlPrevMonth: null
		} satisfies ProtocolTvlEntry

		const [protocol] = applyProtocolTvlSettings({
			protocols: [
				makeProtocol({
					tvl: makeProtocolTvl({
						default: defaultTvl,
						staking: makeTvlEntry(20)
					})
				})
			],
			extraTvlsEnabled: { staking: true },
			minTvl: null,
			maxTvl: null
		})
		if (!protocol) throw new Error('Expected adjusted protocol')

		expect(protocol.tvl?.default).toEqual(makeTvlEntry(120, null, 70, null))
		expect(protocol.tvlChange?.change1d).toBeNull()
		expect(protocol.tvlChange?.change1m).toBeNull()
	})

	test('keeps unknown child protocol table fields unknown after enabled extras are applied', () => {
		const childDefaultTvl = {
			tvl: 70,
			tvlPrevDay: null,
			tvlPrevWeek: 50,
			tvlPrevMonth: null
		} satisfies ProtocolTvlEntry

		const [protocol] = applyProtocolTvlSettings({
			protocols: [
				makeProtocol({
					tvl: makeProtocolTvl({
						default: makeTvlEntry(90),
						staking: makeTvlEntry(20)
					}),
					childProtocols: [
						makeProtocol({
							name: 'Child Protocol',
							slug: 'child-protocol',
							tvl: makeProtocolTvl({
								default: childDefaultTvl,
								staking: makeTvlEntry(20)
							})
						})
					]
				})
			],
			extraTvlsEnabled: { staking: true },
			minTvl: null,
			maxTvl: null
		})
		if (!protocol) throw new Error('Expected adjusted protocol')

		const child = protocol.childProtocols?.[0]
		expect(child?.tvl?.default).toEqual(makeTvlEntry(90, null, 70, null))
		expect(child?.tvlChange?.change1d).toBeNull()
		expect(child?.tvlChange?.change1m).toBeNull()
	})

	test('filters child protocol rows after enabled extras are applied', () => {
		const [protocol] = applyProtocolTvlSettings({
			protocols: [
				makeProtocol({
					tvl: makeProtocolTvl({
						default: makeTvlEntry(90),
						staking: makeTvlEntry(20)
					}),
					childProtocols: [
						makeProtocol({
							name: 'Included Child',
							slug: 'included-child',
							tvl: makeProtocolTvl({
								default: makeTvlEntry(70),
								staking: makeTvlEntry(20)
							})
						}),
						makeProtocol({
							name: 'Filtered Child',
							slug: 'filtered-child',
							tvl: makeProtocolTvl({
								default: makeTvlEntry(70),
								staking: makeTvlEntry(5)
							})
						})
					]
				})
			],
			extraTvlsEnabled: { staking: true },
			minTvl: 80,
			maxTvl: null
		})
		if (!protocol) throw new Error('Expected adjusted protocol')

		expect(protocol.tvl?.default.tvl).toBe(110)
		expect(protocol.childProtocols?.map((child) => child.name)).toEqual(['Included Child'])
		expect(only(protocol.childProtocols ?? []).tvl?.default.tvl).toBe(90)
	})
})
