import { describe, expect, test } from 'vitest'
import {
	buildFlareFAssetsData,
	buildFlareNetworkData,
	buildFlareOverviewData,
	buildFlareStakingData,
	buildFlareTokenomicsData,
	type FAssetsAPIResponse,
	type NetworkAPIResponse,
	type OverviewAPIResponse,
	type StakingAPIResponse,
	type TokenomicsAPIResponse
} from './data'
import { parseDateToTimestampMs, type UpstreamChart } from './transform'

const formatted = (value: number) => ({ value, formatted: `formatted:${value}` })

function chart(dates: string[], series: UpstreamChart['series'], title?: string): UpstreamChart {
	return { dates, series, title }
}

describe('Flare query data builders', () => {
	test('preserves the mixed date contract for calendar, seconds, and milliseconds values', () => {
		expect(parseDateToTimestampMs('2026-01-02')).toBe(Date.UTC(2026, 0, 2))
		expect(parseDateToTimestampMs('1700000000')).toBe(1_700_000_000_000)
		expect(parseDateToTimestampMs('1700000000000')).toBe(1_700_000_000_000)
		expect(parseDateToTimestampMs('2026-01-02T12:30:00Z')).toBe(Date.parse('2026-01-02T12:30:00Z'))
	})

	test('builds overview datasets once while retaining stablecoin filtering and stack order', () => {
		const result = buildFlareOverviewData({
			tvl: {
				tvlChart: chart(
					['2026-01-02', '1700000000'],
					[
						{ name: 'TVL A', data: [10, 11] },
						{ name: 'TVL B', data: [20, 21] }
					]
				),
				kpis: { currentTvl: formatted(31) }
			},
			stablecoins: {
				stablecoinChart: chart(
					['1700000000000'],
					[
						{ name: 'Native', data: [7] },
						{ name: 'Total Supply', data: [12] },
						{ name: 'Bridged', data: [5] }
					]
				),
				kpis: {
					currentCirculating: formatted(12),
					currentMinted: formatted(7),
					currentBridged: formatted(5)
				}
			},
			fxrp: {
				kpis: {
					totalFxrpSupply: formatted(9),
					pctLockedInDefi: formatted(8),
					valueLockedInDefiUsd: formatted(7)
				}
			}
		} satisfies OverviewAPIResponse)

		expect(result.tvl.dataset.source).toEqual([
			[Date.UTC(2026, 0, 2), 10, 20],
			[1_700_000_000_000, 11, 21]
		])
		expect(result.stables.dataset.dimensions).toEqual(['timestamp', 'Native', 'Bridged'])
		expect(result.stables.charts.map(({ name, stack }) => [name, stack])).toEqual([
			['Native', 'Total'],
			['Bridged', 'Total']
		])
		expect(result.stables.kpis).toEqual({
			total: 'formatted:12',
			native: 'formatted:7',
			bridged: 'formatted:5'
		})
	})

	test('keeps daily and cumulative burn snapshots and exact emissions series semantics', () => {
		const dates = ['1700000000', '1700086400000']
		const result = buildFlareTokenomicsData({
			narrative: 'Tokenomics narrative',
			burn: {
				burnChart: chart(dates, [
					{ name: 'Ignored Burn', data: [999, 999] },
					{ name: 'Cumulative Burn', data: [100, 103] },
					{ name: 'Daily Burn', data: [2, 3] }
				]),
				firePool: { status: 'coming_soon', note: 'Pool note', burnDestination: '0x0' },
				kpis: {
					latestDailyBurn: formatted(3),
					burn7d: formatted(4),
					burn30d: formatted(5),
					burnYtd: formatted(6),
					totalGasBurned: formatted(103)
				}
			},
			emissions: {
				emissionsChart: chart(dates, [
					{ name: 'Cumulative', data: [50, 60] },
					{ name: 'Per Epoch', data: [5, 6] }
				]),
				burnVsEmitChart: {
					...chart(dates, [
						{ name: 'Net Inflation', data: [3, 3] },
						{ name: 'Ignored', data: [99, 99] },
						{ name: 'FLR Burned', data: [2, 3] },
						{ name: 'FLR Emitted', data: [5, 6] }
					]),
					subtitle: 'Chart subtitle'
				},
				kpis: {
					latestEpochEmit: formatted(1),
					latestEpochBurn: formatted(2),
					latestNetInflation: formatted(3),
					latestBurnVsEmitPct: formatted(4),
					emit30d: formatted(5),
					burn30d: formatted(6),
					netInflation30d: formatted(7),
					burnVsEmit30dPct: formatted(8),
					cumulativeEmissionsTracked: formatted(9),
					epochsTracked: formatted(10)
				}
			}
		} satisfies TokenomicsAPIResponse)

		expect(result.burn.dailyDataset.source).toEqual([
			[1_700_000_000_000, 2],
			[1_700_086_400_000, 3]
		])
		expect(result.burn.cumulativeDataset.source).toEqual([
			[1_700_000_000_000, 100],
			[1_700_086_400_000, 103]
		])
		expect(result.burn.dailyDataset.dimensions).toEqual(['timestamp', 'Daily Burn'])
		expect(result.burn.cumulativeDataset.dimensions).toEqual(['timestamp', 'Cumulative Burn'])
		expect(result.burn.charts.daily[0]).toMatchObject({ type: 'bar', name: 'Daily Burn', stack: 'a' })
		expect(result.burn.charts.cumulative[0]).toMatchObject({ type: 'line', name: 'Cumulative Burn' })
		expect(result.emissions.perEpochDataset.dimensions).toEqual(['timestamp', 'Per Epoch'])
		expect(result.emissions.burnVsEmitDataset.dimensions).toEqual([
			'timestamp',
			'FLR Emitted',
			'FLR Burned',
			'Net Inflation'
		])
		expect(result.emissions.charts.burnVsEmit.map(({ name, stack }) => [name, stack])).toEqual([
			['FLR Emitted', 'a'],
			['FLR Burned', 'b'],
			['Net Inflation', 'c']
		])
		// Pre-FIP.16-launch payload: no live FIRE data, no inflation block.
		expect(result.fire).toBeNull()
		expect(result.inflation).toBeNull()
	})

	test('builds live FIRE view with stacked source bars, cumulative line, and wallet passthrough', () => {
		const dates = ['2026-05-12', '2026-05-13']
		const wallet = {
			name: 'FIRE - FDC',
			wallet: '0x0ce6831DF00A6018c4d316009980DbAa6c44E525',
			feeToken: 'FLR',
			feesToken: 1262790.9,
			feesUsd: 7416.37,
			feesUsdFormatted: '$7.4K',
			txCount: 1
		}
		const result = buildFlareTokenomicsData({
			burn: {
				burnChart: chart(dates, [
					{ name: 'Daily Burn', data: [2, 3] },
					{ name: 'Cumulative Burn', data: [100, 103] }
				]),
				firePool: {
					status: 'live',
					note: 'FIRE note',
					burnDestination: '0xdEaD',
					liveSince: '2026-05-12',
					feesChart: {
						title: 'FIRE Fees Collected (USD)',
						dates,
						series: [
							{ name: 'FDC', type: 'bar', data: [0, 5] },
							{ name: 'FAssets Minting Fee', type: 'bar', data: [3, 1] },
							{ name: 'FAssets Redemption Fee', type: 'bar', data: [0, 0.2] },
							{ name: 'Tags', type: 'bar', data: [7, 0.5] },
							{ name: 'Cumulative', type: 'line', data: [10, 16.7] }
						]
					},
					wallets: [wallet],
					kpis: {
						totalCollectedUsd: formatted(16.7),
						collected30dUsd: formatted(16.7),
						fdcCollectedUsd: formatted(5),
						mintingFeeCollectedUsd: formatted(4),
						redemptionFeeCollectedUsd: formatted(0.2),
						tagsCollectedUsd: formatted(7.5)
					}
				},
				kpis: {
					latestDailyBurn: formatted(3),
					burn7d: formatted(4),
					burn30d: formatted(5),
					burnYtd: formatted(6),
					totalGasBurned: formatted(103)
				}
			},
			emissions: {
				emissionsChart: chart(dates, [{ name: 'Per Epoch', data: [5, 6] }]),
				burnVsEmitChart: chart(dates, [
					{ name: 'FLR Emitted', data: [5, 6] },
					{ name: 'FLR Burned', data: [2, 3] },
					{ name: 'Net Inflation', data: [3, 3] }
				]),
				kpis: {
					latestEpochEmit: formatted(1),
					latestEpochBurn: formatted(2),
					latestNetInflation: formatted(3),
					latestBurnVsEmitPct: formatted(4),
					emit30d: formatted(5),
					burn30d: formatted(6),
					netInflation30d: formatted(7),
					burnVsEmit30dPct: formatted(8),
					cumulativeEmissionsTracked: formatted(9),
					epochsTracked: formatted(10)
				}
			},
			inflation: {
				inflationPctChart: chart(
					['2022-08-04', '2026-07-30'],
					[{ name: 'Annualized Inflation %', type: 'line', data: [10.14, 3.02] }],
					'Annualized Inflation Rate'
				),
				circulatingSupplyChart: chart(
					['2026-07-01', '2026-08-01'],
					[
						{ name: 'Circulating Supply', type: 'line', data: [87.03e9, 87.19e9] },
						{ name: 'Cumulative On-chain Burned', type: 'line', data: [4.16e9, 4.2e9] }
					]
				),
				emittedByProtocolChart: chart(
					['2026-07-01'],
					[
						{ name: 'FSP', type: 'bar', data: [154e6] },
						{ name: 'Staking', type: 'bar', data: [88e6] }
					]
				),
				burnedByProtocolChart: chart(['2026-07-01'], [{ name: 'FeeBurns', type: 'bar', data: [1.09e6] }]),
				kpis: {
					annualizedInflationPct: formatted(3.02),
					circulatingSupply: formatted(87.19e9),
					cumulativeOnchainBurned: formatted(4.2e9),
					lastMonthEmitted: formatted(354.26e6),
					lastMonthBurned: formatted(47.24e6)
				}
			}
		} satisfies TokenomicsAPIResponse)

		const fire = result.fire
		expect(fire).not.toBeNull()
		expect(fire?.liveSince).toBe('2026-05-12')
		expect(fire?.dataset.dimensions).toEqual([
			'timestamp',
			'FDC',
			'FAssets Minting Fee',
			'FAssets Redemption Fee',
			'Tags',
			'Cumulative'
		])
		expect(fire?.dataset.source[0]).toEqual([Date.UTC(2026, 4, 12), 0, 3, 0, 7, 10])
		expect(fire?.charts.map(({ name, type, stack }) => [name, type, stack])).toEqual([
			['FDC', 'bar', 'fire'],
			['FAssets Minting Fee', 'bar', 'fire'],
			['FAssets Redemption Fee', 'bar', 'fire'],
			['Tags', 'bar', 'fire'],
			['Cumulative', 'line', undefined]
		])
		expect(fire?.wallets).toEqual([wallet])
		expect(fire?.kpis.totalCollectedUsd).toBe('formatted:16.7')
		expect(fire?.kpis.redemptionFeeCollectedUsd).toBe('formatted:0.2')

		const inf = result.inflation
		expect(inf).not.toBeNull()
		expect(inf?.kpis.annualizedInflationPct).toBe('formatted:3.02')
		expect(inf?.pctChart?.dataset.source).toEqual([
			[Date.UTC(2022, 7, 4), 10.14],
			[Date.UTC(2026, 6, 30), 3.02]
		])
		// Full FIP.16 history must stay visible: no default data zoom on these charts.
		expect(inf?.pctChart?.chartOptions?.dataZoom).toBeUndefined()
		expect(inf?.emittedByProtocol?.charts.map(({ name, stack }) => [name, stack])).toEqual([
			['FSP', 'protocol'],
			['Staking', 'protocol']
		])
		expect(inf?.circulatingChart?.charts).toMatchObject([
			{ name: 'Circulating Supply', color: '#2D63F6' },
			{ name: 'Cumulative On-chain Burned', hideAreaStyle: true }
		])
	})

	test('falls back to null FIRE view when the pool payload has no chart or kpis', () => {
		const dates = ['2026-05-12']
		const base = {
			burnChart: chart(dates, [
				{ name: 'Daily Burn', data: [2] },
				{ name: 'Cumulative Burn', data: [100] }
			]),
			kpis: {
				latestDailyBurn: formatted(3),
				burn7d: formatted(4),
				burn30d: formatted(5),
				burnYtd: formatted(6),
				totalGasBurned: formatted(103)
			}
		}
		const emissions = {
			emissionsChart: chart(dates, [{ name: 'Per Epoch', data: [5] }]),
			burnVsEmitChart: chart(dates, [{ name: 'FLR Emitted', data: [5] }]),
			kpis: {
				latestEpochEmit: formatted(1),
				latestEpochBurn: formatted(2),
				latestNetInflation: formatted(3),
				latestBurnVsEmitPct: formatted(4),
				emit30d: formatted(5),
				burn30d: formatted(6),
				netInflation30d: formatted(7),
				burnVsEmit30dPct: formatted(8),
				cumulativeEmissionsTracked: formatted(9),
				epochsTracked: formatted(10)
			}
		}
		const liveWithoutChart = buildFlareTokenomicsData({
			burn: { ...base, firePool: { status: 'live', note: 'n', burnDestination: '0x0' } },
			emissions
		} satisfies TokenomicsAPIResponse)
		expect(liveWithoutChart.fire).toBeNull()
		expect(liveWithoutChart.burn.firePoolNote).toBe('n')
	})

	test('passes FAssets locked-over-time series through (Flare vs. all networks), plus pie order', () => {
		const base: Omit<FAssetsAPIResponse, 'lockedOverTimeChart'> = {
			narrative: 'FAssets narrative',
			distributionChart: {
				labels: ['Protocol B', 'Protocol A'],
				series: [{ name: 'USD', data: [20] }]
			},
			allNetworksDistributionChart: {
				labels: ['Protocol A (Flare)', 'Protocol A (Ethereum)'],
				series: [{ name: 'USD', data: [15, 5] }]
			},
			kpis: {
				totalFxrpSupply: formatted(1),
				pctLockedInDefi: formatted(2),
				valueLockedInDefiUsd: formatted(3),
				fxrpLockedInDefi: formatted(4),
				totalDefiTransactions: formatted(5),
				totalMinters: formatted(6),
				mintCount: formatted(7),
				burnCount: formatted(8),
				swapCount: formatted(9)
			}
		}
		const result = buildFlareFAssetsData({
			...base,
			lockedOverTimeChart: chart(
				['2026-01-02'],
				[
					{ name: 'FXRP Locked (Flare)', data: [1] },
					{ name: 'FXRP Locked (All Networks)', type: 'line', data: [2] }
				]
			)
		})

		expect(result.charts.locked?.dataset.dimensions).toEqual([
			'timestamp',
			'FXRP Locked (Flare)',
			'FXRP Locked (All Networks)'
		])
		expect(result.charts.locked?.charts).toMatchObject([
			{ name: 'FXRP Locked (Flare)', color: '#E62058' },
			{ name: 'FXRP Locked (All Networks)', hideAreaStyle: true }
		])
		expect(result.charts.dist?.data).toEqual([
			{ name: 'Protocol B', value: 20 },
			{ name: 'Protocol A', value: 0 }
		])
		expect(result.charts.allNetworksDist?.data).toEqual([
			{ name: 'Protocol A (Flare)', value: 15 },
			{ name: 'Protocol A (Ethereum)', value: 5 }
		])
	})

	test('preserves network first-series bars and staking legend/config order', () => {
		const network = buildFlareNetworkData({
			transactionsChart: chart(
				['2026-01-02'],
				[
					{ name: 'Transactions API', data: [5] },
					{ name: 'Ignored', data: [9] }
				]
			),
			activeAccountsChart: chart(['2026-01-02'], [{ name: 'Accounts API', data: [2] }]),
			kpis: {
				totalTransactions: formatted(1),
				transactions24h: formatted(2),
				avgDailyTxs7d: formatted(3),
				avgDailyTxs30d: formatted(4),
				totalAddresses: formatted(5)
			}
		} satisfies NetworkAPIResponse)
		const staking = buildFlareStakingData({
			stakingDelegationChart: chart(
				['2026-01-02'],
				[
					{ name: 'P-Chain Stake', data: [7] },
					{ name: 'FTSO Delegation', data: [8] }
				]
			),
			kpis: {
				pctStakedOrDelegated: formatted(1),
				ftsoDelegated: formatted(2),
				totalStake: formatted(3),
				validatorCount: formatted(4),
				averageUptime: formatted(5)
			}
		} satisfies StakingAPIResponse)

		expect(network.charts.transactions.dataset.dimensions).toEqual(['timestamp', 'Transactions API'])
		expect(network.charts.transactions.charts[0]).toMatchObject({
			type: 'bar',
			name: 'Transactions API',
			stack: 'a'
		})
		expect(staking.chart?.seriesNames).toEqual(['P-Chain Stake', 'FTSO Delegation'])
		expect(staking.chart?.charts).toMatchObject([
			{ name: 'P-Chain Stake', color: '#FF7A1A', hideAreaStyle: true },
			{ name: 'FTSO Delegation', color: '#2D63F6', hideAreaStyle: true }
		])
	})
})
