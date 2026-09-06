import { describe, expect, test } from 'vitest'
import type {
	AdapterChainProtocol,
	AdapterMetricPeriods,
	IAdapterChainMetrics
} from '~/containers/AdapterMetrics/api.types'
import type { IAdapterChainOverview } from '~/containers/AdapterMetrics/types'
import { buildDimensionProtocolMetrics, getProtocolEarningsValue } from '../readModel'

const metricRow = (
	defillamaId: string,
	totals: AdapterMetricPeriods & { monthlyAverage1y?: number | null }
): AdapterChainProtocol => ({
	defillamaId,
	name: defillamaId,
	displayName: defillamaId,
	module: null,
	category: null,
	logo: '',
	chains: [],
	protocolType: '',
	methodologyURL: null,
	methodology: null,
	slug: defillamaId,
	id: defillamaId,
	breakdown24h: null,
	breakdown30d: null,
	total24h: totals.total24h ?? null,
	total7d: totals.total7d ?? null,
	total30d: totals.total30d ?? null,
	total1y: totals.total1y ?? null,
	annualized1y: totals.annualized1y ?? null,
	monthlyAverage1y: totals.monthlyAverage1y ?? null,
	totalAllTime: totals.totalAllTime ?? null,
	change_7dover7d: totals.change_7dover7d ?? null
})

const metricResponse = (protocols: Array<AdapterChainProtocol>): IAdapterChainMetrics => ({ allChains: [], protocols })
const dexResponse = (protocols: Array<AdapterChainProtocol>): IAdapterChainOverview => ({
	allChains: [],
	protocols,
	totalDataChart: []
})

describe('buildDimensionProtocolMetrics', () => {
	test('normalizes nullable activity periods to zero inside successful listings', () => {
		expect(
			buildDimensionProtocolMetrics({
				fees: metricResponse([
					metricRow('kept', {
						total24h: 10,
						total7d: 70,
						total30d: 300,
						total1y: 3000,
						annualized1y: 3650,
						monthlyAverage1y: 250,
						totalAllTime: 5000
					}),
					metricRow('kept-without-24h', { total24h: null, total7d: 70, annualized1y: 3650 }),
					metricRow('skipped', { total24h: null, annualized1y: null })
				]),
				revenue: metricResponse([
					metricRow('kept', { total24h: 4, total7d: 28, annualized1y: null }),
					metricRow('kept-without-24h', { total24h: null, total30d: 300 })
				]),
				holdersRevenue: metricResponse([
					metricRow('kept', { total24h: 2, total7d: 14, totalAllTime: 100 }),
					metricRow('kept-without-24h', { total24h: null, totalAllTime: 1000 })
				]),
				activity: {
					dexs: dexResponse([
						metricRow('kept', { total24h: 20, total7d: 140, change_7dover7d: 12, totalAllTime: 900 }),
						metricRow('kept-without-24h', { total24h: null, total7d: 700, change_7dover7d: 10 })
					])
				}
			})
		).toEqual({
			kept: {
				fees: {
					total24h: 10,
					total7d: 70,
					total30d: 300,
					total1y: 3000,
					annualized1y: 3650,
					monthlyAverage1y: 250,
					totalAllTime: 5000
				},
				revenue: {
					total24h: 4,
					total7d: 28,
					total30d: 0,
					total1y: 0,
					annualized1y: null,
					monthlyAverage1y: 0,
					totalAllTime: 0
				},
				holdersRevenue: {
					total24h: 2,
					total7d: 14,
					total30d: 0,
					total1y: 0,
					monthlyAverage1y: 0,
					totalAllTime: 100
				},
				dexs: {
					total24h: 20,
					total7d: 140,
					total30d: 0,
					change_7dover7d: 12,
					totalAllTime: 900
				}
			},
			'kept-without-24h': {
				fees: {
					total24h: 0,
					total7d: 70,
					total30d: 0,
					total1y: 0,
					annualized1y: 3650,
					monthlyAverage1y: 0,
					totalAllTime: 0
				},
				revenue: {
					total24h: 0,
					total7d: 0,
					total30d: 300,
					total1y: 0,
					annualized1y: null,
					monthlyAverage1y: 0,
					totalAllTime: 0
				},
				holdersRevenue: {
					total24h: 0,
					total7d: 0,
					total30d: 0,
					total1y: 0,
					monthlyAverage1y: 0,
					totalAllTime: 1000
				},
				dexs: {
					total24h: 0,
					total7d: 700,
					total30d: 0,
					change_7dover7d: 10,
					totalAllTime: 0
				}
			},
			skipped: {
				fees: {
					total24h: 0,
					total7d: 0,
					total30d: 0,
					total1y: 0,
					annualized1y: null,
					monthlyAverage1y: 0,
					totalAllTime: 0
				}
			}
		})
	})

	test('keeps extended activity sources distinct and preserves listed nullable periods', () => {
		const result = buildDimensionProtocolMetrics({
			fees: null,
			revenue: null,
			holdersRevenue: null,
			activity: {
				perps: metricResponse([
					metricRow('venue', { total24h: 100, total7d: null, total30d: 3000, change_7dover7d: 20 })
				]),
				normalizedVolume: metricResponse([metricRow('venue', { total24h: 80, total7d: 500 })]),
				activeLiquidity: metricResponse([metricRow('venue', { total24h: 400 })]),
				openInterest: metricResponse([metricRow('venue', { total24h: 250 })]),
				optionsPremiumVolume: metricResponse([metricRow('options', { total24h: 5 })]),
				optionsNotionalVolume: metricResponse([metricRow('options', { total24h: 50 })]),
				dexAggregators: metricResponse([metricRow('router', { total24h: 40 })]),
				perpsAggregators: metricResponse([metricRow('router', { total24h: 30 })]),
				bridgeAggregators: metricResponse([metricRow('router', { total24h: 20 })])
			}
		})

		expect(result.venue).toMatchObject({
			perps: { total24h: 100, total7d: null, total30d: 3000, change_7dover7d: 20 },
			normalizedVolume: { total24h: 80, total7d: 500 },
			activeLiquidity: { total24h: 400 },
			openInterest: { total24h: 250 }
		})
		expect(result.options).toMatchObject({
			optionsPremiumVolume: { total24h: 5 },
			optionsNotionalVolume: { total24h: 50 }
		})
		expect(result.router).toMatchObject({
			dexAggregators: { total24h: 40 },
			perpsAggregators: { total24h: 30 },
			bridgeAggregators: { total24h: 20 }
		})
	})

	test('clamps only normalized 24h volume to reported perp volume', () => {
		const result = buildDimensionProtocolMetrics({
			fees: null,
			revenue: null,
			holdersRevenue: null,
			activity: {
				perps: metricResponse([
					metricRow('clamped', { total24h: 100, total7d: 400, total30d: 1000 }),
					metricRow('lower-normalized', { total24h: 100 }),
					metricRow('missing-reported', { total24h: null })
				]),
				normalizedVolume: metricResponse([
					metricRow('clamped', { total24h: 120, total7d: 500, total30d: 1200 }),
					metricRow('lower-normalized', { total24h: 80 }),
					metricRow('missing-reported', { total24h: 50 }),
					metricRow('normalized-only', { total24h: 25 })
				])
			}
		})

		expect(result.clamped.normalizedVolume).toMatchObject({
			total24h: 100,
			total7d: 500,
			total30d: 1200
		})
		expect(result['lower-normalized'].normalizedVolume?.total24h).toBe(80)
		expect(result['missing-reported'].normalizedVolume?.total24h).toBeNull()
		expect(result['normalized-only'].normalizedVolume?.total24h).toBeNull()
	})
})

describe('getProtocolEarningsValue', () => {
	test('preserves zero and only subtracts when both sources are available', () => {
		expect(getProtocolEarningsValue(10, 0)).toBe(10)
		expect(getProtocolEarningsValue(0, 0)).toBe(0)
		expect(getProtocolEarningsValue(10, null)).toBeNull()
		expect(getProtocolEarningsValue(null, 2)).toBeNull()
	})
})
