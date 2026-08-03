import { describe, expect, it } from 'vitest'
import type { ProtocolAggregateTableRow, ProtocolTableMetrics } from '../../../unifiedTable/contracts'
import { aggregateMetrics, buildProtocolAggregationPlan } from './aggregation'

function protocolRow(protocolId: string, name: string, metrics: ProtocolTableMetrics): ProtocolAggregateTableRow {
	return {
		rowType: 'protocol',
		id: protocolId,
		name,
		protocolId,
		displayName: name,
		logo: '',
		chain: null,
		category: null,
		chains: [],
		oracles: [],
		parentProtocolId: null,
		parentProtocolName: null,
		parentProtocolLogo: null,
		metrics
	}
}

describe('aggregateMetrics fee ratios', () => {
	it('materializes only requested metric families', () => {
		const aggregationPlan = buildProtocolAggregationPlan({
			baseMetricFamilies: ['tvl'],
			pointMetrics: [],
			supplementalMetrics: [],
			requestedRatioDependencies: { marketCap: false, tvl: true, fees: false, revenue: false },
			needsOracleMembership: false
		})
		const result = aggregateMetrics([protocolRow('one', 'One', { tvl: 100, tvlPrevDay: 80, volume24h: 1_000 })], {
			excludeParentTvl: false,
			aggregationPlan
		})

		expect(result).toMatchObject({ tvl: 100, change1d: 25 })
		expect(result).not.toHaveProperty('volume24h')
		expect(result).not.toHaveProperty('mcap')
	})

	it('uses summed annualized fee and revenue fields for P/F and P/S', () => {
		const rows = [
			protocolRow('one', 'One', {
				mcap: 12_000,
				fees_30d: 3000,
				feesAnnualized1y: 60_000,
				revenue_30d: 1000,
				revenueAnnualized1y: null
			})
		]

		const result = aggregateMetrics(rows)

		expect(result.pf).toBe(0.2)
		expect(result.ps).toBeNull()
	})

	it('keeps P/F null when any fee-contributing row is missing annualized fees', () => {
		const rows = [
			protocolRow('one', 'One', {
				mcap: 12_000,
				fees_30d: 3000,
				feesAnnualized1y: 60_000
			}),
			protocolRow('two', 'Two', {
				mcap: 3000,
				fees_30d: 1000,
				feesAnnualized1y: null
			})
		]

		const result = aggregateMetrics(rows)

		expect(result.fees_30d).toBe(4000)
		expect(result.feesAnnualized1y).toBeNull()
		expect(result.average_1y).toBeNull()
		expect(result.pf).toBeNull()
	})

	it('keeps grouped revenue monthly averages null when annualized revenue is incomplete', () => {
		const result = aggregateMetrics([
			protocolRow('one', 'One', { revenue_30d: 100, revenueAnnualized1y: 1_200, average_revenue_1y: 100 }),
			protocolRow('two', 'Two', { revenue_30d: 50, revenueAnnualized1y: null, average_revenue_1y: null })
		])

		expect(result.revenueAnnualized1y).toBeNull()
		expect(result.average_revenue_1y).toBeNull()
	})

	it('does not poison annualized totals with a successful inactive row', () => {
		const result = aggregateMetrics([
			protocolRow('active', 'Active', { fees24h: 100, feesAnnualized1y: 36_500 }),
			protocolRow('inactive', 'Inactive', {
				fees24h: 0,
				fees_7d: 0,
				fees_30d: 0,
				fees_1y: 0,
				cumulativeFees: 0,
				feesAnnualized1y: null
			})
		])

		expect(result.feesAnnualized1y).toBe(36_500)
	})
})

describe('aggregateMetrics changes', () => {
	it('reconstructs and sums comparison periods instead of weighting percentages', () => {
		const result = aggregateMetrics([
			protocolRow('one', 'One', { volume24h: 100, volumeChange_1d: 100 }),
			protocolRow('two', 'Two', { volume24h: 100, volumeChange_1d: 0 })
		])

		expect(result.volume24h).toBe(200)
		expect(result.volumeChange_1d).toBeCloseTo(100 / 3)
	})

	it('keeps a grouped change null when a contributing comparison period is unavailable', () => {
		const result = aggregateMetrics([
			protocolRow('one', 'One', { fees24h: 100, feesChange_1d: 10 }),
			protocolRow('two', 'Two', { fees24h: 50, feesChange_1d: null })
		])

		expect(result.fees24h).toBe(150)
		expect(result.feesChange_1d).toBeNull()
	})

	it('ignores a truly inactive zero row when aggregating activity changes', () => {
		const result = aggregateMetrics([
			protocolRow('active', 'Active', {
				volume24h: 100,
				volumeChange_1d: 10,
				volume24h7dAgo: 80
			}),
			protocolRow('zero', 'Zero', {
				volume24h: 0,
				volumeChange_1d: null,
				volume24h7dAgo: null
			})
		])

		expect(result.volume24h).toBe(100)
		expect(result.volumeChange_1d).toBeCloseTo(10)
		expect(result.volume24hChange7dAgo).toBeNull()
	})

	it('keeps a point comparison unknown when a missing current value has an explicit previous value', () => {
		const result = aggregateMetrics([
			protocolRow('active', 'Active', { volume24h: 100, volume24h7dAgo: 80 }),
			protocolRow('missing-current', 'Missing Current', { volume24h: null, volume24h7dAgo: 20 })
		])

		expect(result.volume24hChange7dAgo).toBeNull()
	})

	it('keeps a grouped change unknown when a zero-current row has broader activity', () => {
		const result = aggregateMetrics([
			protocolRow('active', 'Active', { volume24h: 100, volume_7d: 700, volumeChange_1d: 10 }),
			protocolRow('inactive-today', 'Inactive Today', { volume24h: 0, volume_7d: 50, volumeChange_1d: null })
		])

		expect(result.volumeChange_1d).toBeNull()
	})

	it('keeps a grouped change null when an inactive current row has broader-period activity', () => {
		const result = aggregateMetrics([
			protocolRow('active', 'Active', { fees24h: 100, fees_7d: 700, feesChange_1d: 10 }),
			protocolRow('inactive-today', 'Inactive Today', { fees24h: null, fees_7d: 50, feesChange_1d: null })
		])

		expect(result.fees24h).toBe(100)
		expect(result.feesChange_1d).toBeNull()
	})

	it('keeps a grouped change null when missing current activity has a negative broader period', () => {
		const result = aggregateMetrics([
			protocolRow('active', 'Active', { revenue24h: 100, revenue_7d: 700, revenueChange_1d: 10 }),
			protocolRow('missing-current', 'Missing Current', {
				revenue24h: null,
				revenue_7d: -50,
				revenueChange_1d: null
			})
		])

		expect(result.revenueChange_1d).toBeNull()
	})

	it('does not treat an explicit zero broader period as missing activity', () => {
		const result = aggregateMetrics([
			protocolRow('active', 'Active', { fees24h: 100, fees_7d: 700, feesChange_1d: 10 }),
			protocolRow('inactive', 'Inactive', { fees24h: null, fees_7d: 0, feesChange_1d: null })
		])

		expect(result.feesChange_1d).toBeCloseTo(10)
	})

	it('reconstructs a negative comparison value when activity crosses zero', () => {
		const result = aggregateMetrics([protocolRow('one', 'One', { revenue24h: 50, revenueChange_1d: -150 })])

		expect(result.revenueChange_1d).toBe(-150)
	})

	it('aggregates 30d holder revenue change from reconstructed comparison totals', () => {
		const result = aggregateMetrics([
			protocolRow('one', 'One', { holdersRevenue30d: 100, holderRevenueChange30dOver30d: 100 }),
			protocolRow('two', 'Two', { holdersRevenue30d: 100, holderRevenueChange30dOver30d: 0 })
		])

		expect(result.holdersRevenue30d).toBe(200)
		expect(result.holderRevenueChange30dOver30d).toBeCloseTo(100 / 3)
	})

	it('keeps a grouped change null when a minus 100 percent row has no reconstructable prior value', () => {
		const result = aggregateMetrics([protocolRow('one', 'One', { revenue24h: 0, revenueChange_1d: -100 })])

		expect(result.revenueChange_1d).toBeNull()
	})

	it('sums exact source shares and preserves incomplete membership as unknown', () => {
		const exact = aggregateMetrics([
			protocolRow('one', 'One', { volumeDominance_24h: 10 }),
			protocolRow('two', 'Two', { volumeDominance_24h: 5 })
		])
		const incomplete = aggregateMetrics([
			protocolRow('one', 'One', { perps_volume_dominance_24h: 10 }),
			protocolRow('two', 'Two', { perps_volume_dominance_24h: null })
		])

		expect(exact.volumeDominance_24h).toBe(15)
		expect(incomplete.perps_volume_dominance_24h).toBeNull()
	})

	it('requires a previous TVL value for every current TVL contributor', () => {
		const result = aggregateMetrics([
			protocolRow('one', 'One', { tvl: 100, tvlPrevDay: 80 }),
			protocolRow('two', 'Two', { tvl: 50, tvlPrevDay: null })
		])

		expect(result.tvl).toBe(150)
		expect(result.change1d).toBeNull()
	})

	it('excludes parent TVL rows from both totals and change completeness', () => {
		const excluded = protocolRow('excluded', 'Excluded', { tvl: 100, tvlPrevDay: null })
		excluded.excludeTvlFromParent = true
		const included = protocolRow('included', 'Included', { tvl: 50, tvlPrevDay: 25 })

		const result = aggregateMetrics([excluded, included], { excludeParentTvl: true })

		expect(result.tvl).toBe(50)
		expect(result.tvlPrevDay).toBe(25)
		expect(result.change1d).toBe(100)
	})

	it('uses canonical parent market metrics instead of an arbitrary child token', () => {
		const first = protocolRow('securitize-buidl', 'BUIDL', { mcap: 4_000, fdv: 5_000 })
		first.parentProtocolId = 'securitize'
		const second = protocolRow('securitize-dsf', 'DSF', { mcap: 7_000, fdv: 8_000 })
		second.parentProtocolId = 'securitize'

		const result = aggregateMetrics([first, second], {
			excludeParentTvl: false,
			parentMetrics: { securitize: { mcap: 19_000, fdv: 20_000 } }
		})

		expect(result.mcap).toBe(19_000)
		expect(result.fdv).toBe(20_000)
	})

	it('deduplicates a protocol market value across chain rows without substituting its parent value', () => {
		const source = protocolRow('securitize-dsf', 'DSF', { mcap: 7_000, fdv: 8_000 })
		source.parentProtocolId = 'securitize'
		const rows = ['Ethereum', 'Solana'].map((chain) => ({
			...source,
			rowType: 'protocol-chain' as const,
			id: `${source.id}-${chain}`,
			chain
		}))

		const result = aggregateMetrics(rows, {
			excludeParentTvl: false,
			marketValueScope: 'protocol',
			parentMetrics: { securitize: { mcap: 19_000, fdv: 20_000 } }
		})

		expect(result.mcap).toBe(7_000)
		expect(result.fdv).toBe(8_000)
	})

	it('replaces incomplete child open interest with the canonical parent total', () => {
		const first = protocolRow('gmx-v1', 'GMX V1', { openInterest: null })
		first.parentProtocolId = 'gmx'
		const second = protocolRow('gmx-v2', 'GMX V2', { openInterest: 40 })
		second.parentProtocolId = 'gmx'

		const result = aggregateMetrics([first, second], {
			excludeParentTvl: false,
			parentMetrics: {
				gmx: {
					mcap: null,
					fdv: null,
					supplements: {
						openInterest: {
							childProtocolIds: ['gmx-v1', 'gmx-v2'],
							childProtocolIdsByChain: {},
							metrics: { openInterest: 100 },
							metricsByChain: {}
						}
					}
				}
			}
		})

		expect(result.openInterest).toBe(100)
	})

	it('uses the selected-chain parent open interest without replacing a partial ecosystem', () => {
		const first = protocolRow('gmx-v1', 'GMX V1', { openInterest: 20 })
		first.parentProtocolId = 'gmx'
		const second = protocolRow('gmx-v2', 'GMX V2', { openInterest: null })
		second.parentProtocolId = 'gmx'
		const ethereumRows = [first, second].map((row) => ({
			...row,
			rowType: 'protocol-chain' as const,
			chain: 'Ethereum'
		}))
		const parentMetrics = {
			gmx: {
				mcap: null,
				fdv: null,
				supplements: {
					openInterest: {
						childProtocolIds: ['gmx-v1', 'gmx-v2'],
						childProtocolIdsByChain: { ethereum: ['gmx-v1', 'gmx-v2'] },
						metrics: { openInterest: 100 },
						metricsByChain: { ethereum: { openInterest: 60 } }
					}
				}
			}
		}

		expect(aggregateMetrics(ethereumRows, { excludeParentTvl: false, parentMetrics }).openInterest).toBe(60)
		const firstEthereumRow = ethereumRows[0]
		if (!firstEthereumRow) throw new Error('Expected an Ethereum child row')
		expect(aggregateMetrics([firstEthereumRow], { excludeParentTvl: false, parentMetrics }).openInterest).toBe(20)
	})

	it('adds a canonical parent earnings supplement exactly once', () => {
		const first = protocolRow('aave-v2', 'Aave V2', {})
		first.parentProtocolId = 'aave'
		const second = protocolRow('aave-v3', 'Aave V3', {})
		second.parentProtocolId = 'aave'

		const result = aggregateMetrics([first, second], {
			excludeParentTvl: false,
			parentMetrics: {
				aave: {
					mcap: null,
					fdv: null,
					supplements: {
						earnings: {
							childProtocolIds: ['aave-v2', 'aave-v3'],
							childProtocolIdsByChain: {},
							metricsByChain: {},
							metrics: { earnings24h: 100, earnings7d: 700, earnings30d: 3000, earnings1y: 36_500 }
						}
					}
				}
			}
		})

		expect(result.earnings24h).toBe(100)
		expect(result.earnings1y).toBe(36_500)
	})

	it('keeps parent earnings unknown when filters retain only part of the ecosystem', () => {
		const child = protocolRow('aave-v3', 'Aave V3', {})
		child.parentProtocolId = 'aave'

		const result = aggregateMetrics([child], {
			excludeParentTvl: false,
			parentMetrics: {
				aave: {
					mcap: null,
					fdv: null,
					supplements: {
						earnings: {
							childProtocolIds: ['aave-v2', 'aave-v3'],
							childProtocolIdsByChain: {},
							metricsByChain: {},
							metrics: { earnings24h: 100, earnings7d: 700, earnings30d: 3000, earnings1y: 36_500 }
						}
					}
				}
			}
		})

		expect(result.earnings24h).toBeNull()
	})

	it('reuses parent membership for chain-specific earnings and bridge supplements', () => {
		const first = protocolRow('aave-v2', 'Aave V2', {})
		first.parentProtocolId = 'aave'
		const second = protocolRow('aave-v3', 'Aave V3', {})
		second.parentProtocolId = 'aave'
		const rows = [first, second].map((row) => ({ ...row, rowType: 'protocol-chain' as const, chain: 'Ethereum' }))

		const result = aggregateMetrics(rows, {
			excludeParentTvl: false,
			parentMetrics: {
				aave: {
					mcap: null,
					fdv: null,
					supplements: {
						earnings: {
							childProtocolIds: ['unused-global-child'],
							childProtocolIdsByChain: { ethereum: ['aave-v2', 'aave-v3'] },
							metrics: { earnings24h: 999, earnings7d: 999, earnings30d: 999, earnings1y: 999 },
							metricsByChain: {
								ethereum: { earnings24h: 10, earnings7d: 70, earnings30d: 300, earnings1y: 3650 }
							}
						},
						bridgeAggregatorVolume: {
							childProtocolIds: ['unused-global-child'],
							childProtocolIdsByChain: { ethereum: ['aave-v2', 'aave-v3'] },
							metrics: {
								bridgeAggregatorVolume24h: 999,
								bridgeAggregatorVolume7d: 999,
								bridgeAggregatorVolume30d: 999
							},
							metricsByChain: {
								ethereum: {
									bridgeAggregatorVolume24h: 20,
									bridgeAggregatorVolume7d: 140,
									bridgeAggregatorVolume30d: 600,
									bridgeAggregatorVolumeChange1d: 5,
									bridgeAggregatorVolume24h7dAgo: 18,
									bridgeAggregatorVolume24hChange7dAgo: 10,
									bridgeAggregatorVolumeDominance24h: 25
								}
							}
						}
					}
				}
			}
		})

		expect(result.earnings24h).toBe(10)
		expect(result.bridgeAggregatorVolume24h).toBe(20)
		expect(result.bridgeAggregatorVolumeChange1d).toBe(5)
		expect(result.bridgeAggregatorVolumeDominance24h).toBe(25)
	})
})
