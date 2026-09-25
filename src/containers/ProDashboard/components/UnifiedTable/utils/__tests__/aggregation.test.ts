import { describe, expect, test } from 'vitest'
import type { ProtocolAggregateTableRow, ProtocolTableMetrics } from '../../../../unifiedTable/contracts'
import { aggregateMetrics, buildProtocolAggregationPlan } from '../aggregation'

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
	test('materializes only requested metric families', () => {
		const aggregationPlan = buildProtocolAggregationPlan({
			baseMetricFamilies: ['tvl'],
			pointMetrics: [],
			supplementalMetrics: [],
			requestedRatioDependencies: { marketCap: false, tvl: true, fees: false, revenue: false },
			needsOracleMembership: false
		})
		const result = aggregateMetrics([protocolRow('one', 'One', { tvl: 100, tvlPrevDay: 80, volume24h: 1000 })], {
			excludeParentTvl: false,
			aggregationPlan
		})

		expect(result).toMatchObject({ tvl: 100, change1d: 25 })
		expect(result).not.toHaveProperty('volume24h')
		expect(result).not.toHaveProperty('mcap')
	})

	test('uses summed annualized fee and revenue fields for P/F and P/S', () => {
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

	test('keeps P/F null when any fee-contributing row is missing annualized fees', () => {
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

	test('keeps grouped revenue monthly averages null when annualized revenue is incomplete', () => {
		const result = aggregateMetrics([
			protocolRow('one', 'One', { revenue_30d: 100, revenueAnnualized1y: 1200, average_revenue_1y: 100 }),
			protocolRow('two', 'Two', { revenue_30d: 50, revenueAnnualized1y: null, average_revenue_1y: null })
		])

		expect(result.revenueAnnualized1y).toBeNull()
		expect(result.average_revenue_1y).toBeNull()
	})

	test('does not poison annualized totals with a successful inactive row', () => {
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
	test('reconstructs and sums comparison periods instead of weighting percentages', () => {
		const result = aggregateMetrics([
			protocolRow('one', 'One', { volume24h: 100, volumeChange_1d: 100 }),
			protocolRow('two', 'Two', { volume24h: 100, volumeChange_1d: 0 })
		])

		expect(result.volume24h).toBe(200)
		expect(result.volumeChange_1d).toBeCloseTo(100 / 3)
	})

	test('keeps a grouped change null when a contributing comparison period is unavailable', () => {
		const result = aggregateMetrics([
			protocolRow('one', 'One', { fees24h: 100, feesChange_1d: 10 }),
			protocolRow('two', 'Two', { fees24h: 50, feesChange_1d: null })
		])

		expect(result.fees24h).toBe(150)
		expect(result.feesChange_1d).toBeNull()
	})

	test('ignores a truly inactive zero row when aggregating activity changes', () => {
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

	test('keeps a point comparison unknown when a missing current value has an explicit previous value', () => {
		const result = aggregateMetrics([
			protocolRow('active', 'Active', { volume24h: 100, volume24h7dAgo: 80 }),
			protocolRow('missing-current', 'Missing Current', { volume24h: null, volume24h7dAgo: 20 })
		])

		expect(result.volume24hChange7dAgo).toBeNull()
	})

	test('keeps a grouped change unknown when a zero-current row has broader activity', () => {
		const result = aggregateMetrics([
			protocolRow('active', 'Active', { volume24h: 100, volume_7d: 700, volumeChange_1d: 10 }),
			protocolRow('inactive-today', 'Inactive Today', { volume24h: 0, volume_7d: 50, volumeChange_1d: null })
		])

		expect(result.volumeChange_1d).toBeNull()
	})

	test('keeps a grouped change null when an inactive current row has broader-period activity', () => {
		const result = aggregateMetrics([
			protocolRow('active', 'Active', { fees24h: 100, fees_7d: 700, feesChange_1d: 10 }),
			protocolRow('inactive-today', 'Inactive Today', { fees24h: null, fees_7d: 50, feesChange_1d: null })
		])

		expect(result.fees24h).toBe(100)
		expect(result.feesChange_1d).toBeNull()
	})

	test('keeps a grouped change null when missing current activity has a negative broader period', () => {
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

	test('does not treat an explicit zero broader period as missing activity', () => {
		const result = aggregateMetrics([
			protocolRow('active', 'Active', { fees24h: 100, fees_7d: 700, feesChange_1d: 10 }),
			protocolRow('inactive', 'Inactive', { fees24h: null, fees_7d: 0, feesChange_1d: null })
		])

		expect(result.feesChange_1d).toBeCloseTo(10)
	})

	test('reconstructs a negative comparison value when activity crosses zero', () => {
		const result = aggregateMetrics([protocolRow('one', 'One', { revenue24h: 50, revenueChange_1d: -150 })])

		expect(result.revenueChange_1d).toBe(-150)
	})

	test('aggregates 30d holder revenue change from reconstructed comparison totals', () => {
		const result = aggregateMetrics([
			protocolRow('one', 'One', { holdersRevenue30d: 100, holderRevenueChange30dOver30d: 100 }),
			protocolRow('two', 'Two', { holdersRevenue30d: 100, holderRevenueChange30dOver30d: 0 })
		])

		expect(result.holdersRevenue30d).toBe(200)
		expect(result.holderRevenueChange30dOver30d).toBeCloseTo(100 / 3)
	})

	test('aggregates 7d holder revenue change from reconstructed comparison totals', () => {
		const result = aggregateMetrics([
			protocolRow('one', 'One', { holderRevenue_7d: 100, holderRevenueChange7dOver7d: 100 }),
			protocolRow('two', 'Two', { holderRevenue_7d: 100, holderRevenueChange7dOver7d: 0 })
		])

		expect(result.holderRevenue_7d).toBe(200)
		expect(result.holderRevenueChange7dOver7d).toBeCloseTo(100 / 3)
	})

	test('keeps grouped 30d holder revenue change null when a longer period proves a missing contributor', () => {
		const result = aggregateMetrics([
			protocolRow('measured', 'Measured', { holdersRevenue30d: 100, holderRevenueChange30dOver30d: 0 }),
			protocolRow('missing', 'Missing', { holderRevenue_90d: 50 })
		])

		expect(result.holderRevenueChange30dOver30d).toBeNull()
	})

	test('aggregates long-period activity changes from reconstructed comparison totals', () => {
		const result = aggregateMetrics([
			protocolRow('one', 'One', {
				fees_90d: 100,
				feesChange90dOver90d: 100,
				revenue_ytd: 100,
				revenueChangeYtd: 100,
				holderRevenue_1y: 100,
				holderRevenueChange1yOver1y: 100
			}),
			protocolRow('two', 'Two', {
				fees_90d: 100,
				feesChange90dOver90d: 0,
				revenue_ytd: 100,
				revenueChangeYtd: 0,
				holderRevenue_1y: 100,
				holderRevenueChange1yOver1y: 0
			})
		])

		expect(result.feesChange90dOver90d).toBeCloseTo(100 / 3)
		expect(result.revenueChangeYtd).toBeCloseTo(100 / 3)
		expect(result.holderRevenueChange1yOver1y).toBeCloseTo(100 / 3)
	})

	test('keeps a grouped change null when a minus 100 percent row has no reconstructable prior value', () => {
		const result = aggregateMetrics([protocolRow('one', 'One', { revenue24h: 0, revenueChange_1d: -100 })])

		expect(result.revenueChange_1d).toBeNull()
	})

	test('sums available source shares without inventing an all-unavailable total', () => {
		const exact = aggregateMetrics([
			protocolRow('one', 'One', { volumeDominance_24h: 10 }),
			protocolRow('two', 'Two', { volumeDominance_24h: 5 })
		])
		const partial = aggregateMetrics([
			protocolRow('one', 'One', { perps_volume_dominance_24h: 10 }),
			protocolRow('two', 'Two', { perps_volume_dominance_24h: null })
		])
		const unavailable = aggregateMetrics([
			protocolRow('one', 'One', { options_volume_dominance_24h: null }),
			protocolRow('two', 'Two', { options_volume_dominance_24h: null })
		])

		expect(exact.volumeDominance_24h).toBe(15)
		expect(partial.perps_volume_dominance_24h).toBe(10)
		expect(unavailable.options_volume_dominance_24h).toBeNull()
	})

	test('requires a previous TVL value for every current TVL contributor', () => {
		const result = aggregateMetrics([
			protocolRow('one', 'One', { tvl: 100, tvlPrevDay: 80 }),
			protocolRow('two', 'Two', { tvl: 50, tvlPrevDay: null })
		])

		expect(result.tvl).toBe(150)
		expect(result.change1d).toBeNull()
	})

	test('excludes parent TVL rows from both totals and change completeness', () => {
		const excluded = protocolRow('excluded', 'Excluded', { tvl: 100, tvlPrevDay: null })
		excluded.excludeTvlFromParent = true
		const included = protocolRow('included', 'Included', { tvl: 50, tvlPrevDay: 25 })

		const result = aggregateMetrics([excluded, included], { excludeParentTvl: true })

		expect(result.tvl).toBe(50)
		expect(result.tvlPrevDay).toBe(25)
		expect(result.change1d).toBe(100)
	})

	test('applies parent TVL exclusion to additive TVL breakdowns', () => {
		const excluded = protocolRow('excluded', 'Excluded', { stakingTvl: 100, borrowedTvl: 50, pool2Tvl: 25 })
		excluded.excludeTvlFromParent = true
		const included = protocolRow('included', 'Included', { stakingTvl: 10, borrowedTvl: 20, pool2Tvl: 30 })

		const result = aggregateMetrics([excluded, included], { excludeParentTvl: true })

		expect(result).toMatchObject({ stakingTvl: 10, borrowedTvl: 20, pool2Tvl: 30 })
	})

	test('uses canonical parent market metrics instead of an arbitrary child token', () => {
		const first = protocolRow('securitize-buidl', 'BUIDL', { mcap: 4000, fdv: 5000 })
		first.parentProtocolId = 'securitize'
		const second = protocolRow('securitize-dsf', 'DSF', { mcap: 7000, fdv: 8000 })
		second.parentProtocolId = 'securitize'

		const result = aggregateMetrics([first, second], {
			excludeParentTvl: false,
			parentMetrics: { securitize: { mcap: 19_000, fdv: 20_000 } }
		})

		expect(result.mcap).toBe(19_000)
		expect(result.fdv).toBe(20_000)
	})

	test('deduplicates a protocol market value across chain rows without substituting its parent value', () => {
		const source = protocolRow('securitize-dsf', 'DSF', { mcap: 7000, fdv: 8000 })
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

		expect(result.mcap).toBe(7000)
		expect(result.fdv).toBe(8000)
	})

	test('replaces incomplete child open interest with the canonical parent total', () => {
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

	test('uses canonical parent emissions only for a complete all-chain ecosystem', () => {
		const first = protocolRow('aave-v2', 'Aave V2', {})
		first.parentProtocolId = 'aave'
		const second = protocolRow('aave-v3', 'Aave V3', {})
		second.parentProtocolId = 'aave'
		const parentMetrics = {
			aave: {
				mcap: null,
				fdv: null,
				supplements: {
					incentives: {
						childProtocolIds: ['aave-v2', 'aave-v3'],
						metrics: {
							emissions24h: 1,
							emissions7d: 7,
							emissions30d: 30,
							emissions90d: 90,
							emissions1y: 365,
							emissionsPrev30d: 15
						}
					}
				}
			}
		}

		const complete = aggregateMetrics([first, second], { excludeParentTvl: false, parentMetrics })
		expect(complete.emissions30d).toBe(30)
		expect(complete.emissions90d).toBe(90)
		expect(complete.emissionsChange30dOver30d).toBe(100)
		expect(aggregateMetrics([second], { excludeParentTvl: false, parentMetrics }).emissions30d).toBeNull()
		const chainRows = [first, second].map((row) => ({
			...row,
			rowType: 'protocol-chain' as const,
			chain: 'Ethereum'
		}))
		expect(aggregateMetrics(chainRows, { excludeParentTvl: false, parentMetrics }).emissions30d).toBeNull()
	})

	test('uses the selected-chain parent open interest without replacing a partial ecosystem', () => {
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

	test('adds a canonical parent earnings supplement exactly once', () => {
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

	test('keeps parent earnings unknown when filters retain only part of the ecosystem', () => {
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

	test('reuses parent membership for chain-specific earnings and bridge supplements', () => {
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
