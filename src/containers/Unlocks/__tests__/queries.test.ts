import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { COINS_SERVER_URL, DATASETS_SERVER_URL, SERVER_URL } from '~/constants'
import { fixtureStatus, installFixtureFetch } from '~/utils/test/fixtureFetch'
import { buildUnlocksHistoricalPriceRequests } from '~/utils/unlocks/historicalPriceRequests'
import type {
	EmissionEvent,
	EmissionSupplyMetrics,
	EmissionSeries,
	ProtocolEmission,
	ProtocolEmissionChartData,
	ProtocolEmissionComponentData,
	ProtocolEmissionDetail,
	TokenAllocationSplit
} from '../api.types'

const http = installFixtureFetch()
const DETAIL_API = `${DATASETS_SERVER_URL}/emissions/`
const ALL_API = `${SERVER_URL}/emissions`
const TOKENLIST_API = `${DATASETS_SERVER_URL}/tokenlist/rankings.json`
const CURRENT_PRICES_API = `${COINS_SERVER_URL}/prices/current/`
const HISTORICAL_PRICES_API = 'https://coins.llama.fi/batchHistorical'

// The queries module memoizes the fetched tokenlist; a fresh module per test keeps tests independent.
let queries: typeof import('../queries')
beforeEach(async () => {
	vi.stubEnv('API_KEY', '')
	// No listed token and no current price unless a test says otherwise.
	http.serve({ [TOKENLIST_API]: [], [CURRENT_PRICES_API]: { coins: {} } })
	vi.resetModules()
	queries = await import('../queries')
})
afterEach(() => {
	vi.useRealTimers()
	vi.restoreAllMocks()
	vi.unstubAllEnvs()
})

const serveDetail = (detail: unknown) => http.serve({ [DETAIL_API]: detail })
const serveAll = (protocols: Array<ProtocolEmission>) => http.serve({ [ALL_API]: protocols })

const EMPTY_TOKEN_ALLOCATION: TokenAllocationSplit = {
	current: {},
	final: {},
	progress: {},
	bySection: { current: {}, final: {}, progress: {} }
}

function chartPoint(timestamp: number, unlocked: number, isForecast?: boolean): EmissionSeries['data'][number] {
	return {
		timestamp,
		unlocked,
		rawEmission: unlocked,
		burned: 0,
		...(isForecast === undefined ? {} : { isForecast })
	}
}

function chartData(
	data: Array<EmissionSeries> = [],
	tokenAllocation = EMPTY_TOKEN_ALLOCATION
): ProtocolEmissionChartData {
	return { data, tokenAllocation }
}

interface ProtocolDetailFixture {
	name: string
	geckoId?: string | null
	token?: string
	events?: Array<EmissionEvent>
	notes?: Array<string>
	total?: number
	documentedData?: ProtocolEmissionChartData
	realTimeData?: ProtocolEmissionChartData
	categories?: Record<string, Array<string>>
	supplyMetrics?: EmissionSupplyMetrics
}

function protocolDetail({
	name,
	geckoId = null,
	token = 'coingecko:test',
	events = [],
	notes = [],
	total,
	documentedData = chartData(),
	realTimeData,
	categories = {},
	supplyMetrics
}: ProtocolDetailFixture): ProtocolEmissionDetail {
	return {
		name,
		gecko_id: geckoId,
		pId: null,
		defillamaIds: [],
		chainName: 'Ethereum',
		metadata: { token, protocolIds: [], events, unlockEvents: [], notes, ...(total === undefined ? {} : { total }) },
		documentedData,
		...(realTimeData === undefined ? {} : { realTimeData }),
		unlockUsdChart: [],
		categories,
		...(supplyMetrics === undefined ? {} : { supplyMetrics })
	}
}

function protocolDetailV2(
	fixture: ProtocolDetailFixture,
	componentData: ProtocolEmissionComponentData
): ProtocolEmissionDetail {
	return { ...protocolDetail(fixture), version: 2, componentData }
}

function componentSection(
	displayName: string,
	projection: { isTBD?: boolean; isForecast?: boolean; colorFrom?: string } = {}
): ProtocolEmissionComponentData['sections'][string] {
	return {
		displayName,
		emission24h: 0,
		emission7d: 0,
		emission30d: 0,
		components: {},
		...projection
	}
}

function cliff(timestamp: number, amount: number, category = 'team'): EmissionEvent {
	return { description: 'Cliff', category, unlockType: 'cliff', timestamp, noOfTokens: [amount] }
}

function unknownLinear(timestamp: number): EmissionEvent {
	return {
		description: 'Unknown linear rate',
		category: 'farming',
		unlockType: 'linear',
		timestamp,
		noOfTokens: [],
		rateDurationDays: 7,
		hasUnknownTokenAmount: true
	}
}

function protocolEmission({
	name,
	token,
	events = [],
	geckoId = null,
	totalLocked = 0,
	maxSupply = 0
}: {
	name: string
	token: string
	events?: Array<EmissionEvent>
	geckoId?: string | null
	totalLocked?: number
	maxSupply?: number
}): ProtocolEmission {
	return {
		name,
		token,
		sources: [],
		protocolId: null,
		gecko_id: geckoId,
		circSupply: 0,
		circSupply30d: 0,
		totalLocked,
		maxSupply,
		unlocksPerDay: null,
		unlockEvents: [],
		events
	}
}

describe('buildUnlockTypesByTimestamp', () => {
	test('classifies an ascending event stream in one pass without mutating it', () => {
		const day = 86_400
		const nowSec = 1_700_000_000
		vi.spyOn(Date, 'now').mockReturnValue(nowSec * 1000)
		const events = [
			cliff(nowSec - day, 1),
			cliff(nowSec + day, 1),
			cliff(nowSec + 8 * day, 1),
			cliff(nowSec + 38 * day, 1),
			cliff(nowSec + 128 * day, 1)
		]
		const timestamps = events.map((event) => event.timestamp)
		const result = queries.buildUnlockTypesByTimestamp(events)
		vi.restoreAllMocks()

		expect(result).toEqual(
			new Map([
				[nowSec + day, 'Weekly'],
				[nowSec + 8 * day, 'Monthly'],
				[nowSec + 38 * day, 'Quarterly']
			])
		)
		expect(events.map((event) => event.timestamp)).toEqual(timestamps)
	})
})

describe('getProtocolEmissionsPieData', () => {
	const detail = protocolDetail({
		name: 'Curve Finance',
		token: 'CRV',
		documentedData: chartData([{ label: 'team', data: [chartPoint(1, 10)] }]),
		realTimeData: chartData()
	})

	test('builds allocation data without fetching global supply metadata', async () => {
		serveDetail(detail)

		const result = await queries.getProtocolEmissionsPieData('curve-finance', false)

		expect(result.pieChartData.documented).toEqual([{ name: 'Team', value: 10 }])
		expect(result.meta).toBeNull()
		expect(http.urls()).toEqual([`${DETAIL_API}curve-finance`])
	})

	test('fetches supply metadata for the locked/unlocked chart', async () => {
		serveDetail(detail)
		serveAll([protocolEmission({ name: 'Curve Finance', token: 'CRV', totalLocked: 25, maxSupply: 100 })])

		const result = await queries.getProtocolEmissionsPieData('curve-finance', true)

		expect(result.meta).toMatchObject({ totalLocked: 25, maxSupply: 100 })
	})
})

describe('getProtocolEmissons', () => {
	test('returns the empty result without fetching protocol data when the cached emissions list misses', async () => {
		const result = await queries.getProtocolEmissons('chainlink', {
			emissionsProtocolsList: ['aave']
		})

		expect(queries.isEmptyProtocolEmissionResult(result)).toBe(true)
		expect(http.urls()).toEqual([])
	})

	test('preserves a detail-source failure instead of returning an empty protocol result', async () => {
		http.serve({ [DETAIL_API]: fixtureStatus(400) })

		await expect(
			queries.getProtocolEmissons('chainlink', {
				skipAvailabilityCheck: true,
				tokenlist: {}
			})
		).rejects.toThrow(/400/)
	})

	test('returns the empty result for an explicit missing detail', async () => {
		http.serve({ [DETAIL_API]: fixtureStatus(404) })

		const result = await queries.getProtocolEmissons('missing', {
			skipAvailabilityCheck: true,
			tokenlist: {}
		})

		expect(queries.isEmptyProtocolEmissionResult(result)).toBe(true)
	})

	test('keeps a successful detail with an empty schedule distinct from not-found', async () => {
		serveDetail(protocolDetail({ name: 'Empty Schedule', token: 'coingecko:empty-schedule' }))

		const result = await queries.getProtocolEmissons('empty-schedule', {
			skipAvailabilityCheck: true,
			tokenlist: {}
		})

		expect(queries.isEmptyProtocolEmissionResult(result)).toBe(false)
		expect(result.name).toBe('Empty Schedule')
		expect(result.events).toEqual([])
		expect(result.chartData.documented).toEqual([])
	})

	test('preserves the documented allocation split nested under bySection', async () => {
		const allocation = {
			current: { Ecosystem: 40, Team: 20 },
			final: { Ecosystem: 50, Team: 50 },
			progress: { Ecosystem: 80, Team: 40 },
			bySection: {
				current: { Public: 40, Private: 20 },
				final: { Public: 50, Private: 50 },
				progress: { Public: 80, Private: 40 }
			}
		}
		serveDetail(
			protocolDetail({
				name: 'Aave',
				token: 'coingecko:aave',
				documentedData: chartData([], allocation),
				realTimeData: chartData()
			})
		)

		const result = await queries.getProtocolEmissons('aave', {
			skipAvailabilityCheck: true,
			tokenlist: {}
		})

		expect(result.tokenAllocation.documented).toEqual(allocation)
	})

	test('uses an empty comparison allocation when the canonical detail omits realtime data', async () => {
		const allocation = {
			current: { Team: 20, Ecosystem: 80 },
			final: { Team: 20, Ecosystem: 80 },
			progress: { Team: 100, Ecosystem: 100 },
			bySection: {
				current: { Team: 20, Ecosystem: 80 },
				final: { Team: 20, Ecosystem: 80 },
				progress: { Team: 100, Ecosystem: 100 }
			}
		}
		serveDetail(
			protocolDetail({
				name: 'Documented only',
				token: 'coingecko:documented-only',
				documentedData: chartData([], allocation)
			})
		)

		const result = await queries.getProtocolEmissons('documented-only', {
			skipAvailabilityCheck: true,
			tokenlist: {}
		})

		expect(result.tokenAllocation.documented).toEqual(allocation)
		expect(result.tokenAllocation.realtime).toEqual(EMPTY_TOKEN_ALLOCATION)
	})

	test('uses tokenlist prices for protocol emissions without fetching current coin prices', async () => {
		serveDetail(
			protocolDetail({
				name: 'Chainlink',
				geckoId: 'chainlink',
				token: 'coingecko:chainlink',
				documentedData: chartData([{ label: 'team', data: [chartPoint(1, 10)] }]),
				realTimeData: chartData()
			})
		)

		const result = await queries.getProtocolEmissons('chainlink', {
			skipAvailabilityCheck: true,
			tokenlist: {
				chainlink: {
					current_price: 12.34,
					symbol: 'link'
				}
			}
		})

		expect(http.urls()).toEqual([`${DETAIL_API}chainlink`])
		expect(result.tokenPrice).toEqual({ price: 12.34, symbol: 'LINK' })
	})

	test('builds current supply metadata from protocol detail without fetching the aggregate index', async () => {
		vi.spyOn(Date, 'now').mockReturnValue(2_500_000)
		serveDetail(
			protocolDetail({
				name: 'Plasma',
				geckoId: 'plasma',
				token: 'coingecko:plasma',
				documentedData: chartData([
					{
						label: 'public sale',
						data: [chartPoint(1000, 10), chartPoint(2000, 20), chartPoint(3000, 70)]
					},
					{
						label: 'ecosystem',
						data: [chartPoint(1500, 5), chartPoint(4000, 30)]
					}
				]),
				supplyMetrics: {
					maxSupply: 100,
					adjustedSupply: 100,
					tbdAmount: 0,
					incentiveAmount: 0,
					nonIncentiveAmount: 100
				}
			})
		)

		const result = await queries.getProtocolEmissons('plasma', {
			skipAvailabilityCheck: true,
			tokenlist: {
				plasma: { current_price: 2, symbol: 'xpl' }
			}
		})

		expect(http.urls()).toEqual([`${DETAIL_API}plasma`])
		expect(result.meta).toEqual({
			gecko_id: 'plasma',
			circSupply: 25,
			maxSupply: 100,
			totalLocked: 75,
			mcap: 50
		})
	})

	test('prefers an explicit total over a lower raw supply max', async () => {
		vi.spyOn(Date, 'now').mockReturnValue(2_500_000)
		serveDetail(
			protocolDetail({
				name: 'Binance Smart Chain',
				total: 200,
				documentedData: chartData([{ label: 'validators', data: [chartPoint(1000, 134)] }]),
				supplyMetrics: {
					maxSupply: 134,
					adjustedSupply: 134,
					tbdAmount: 0,
					incentiveAmount: 0,
					nonIncentiveAmount: 134
				}
			})
		)

		const result = await queries.getProtocolEmissons('binance-smart-chain', {
			skipAvailabilityCheck: true,
			tokenlist: {}
		})

		expect(result.meta).toMatchObject({ circSupply: 134, maxSupply: 200, totalLocked: 66 })
	})

	test('uses documented final supply instead of a TBD-inflated raw supply max', async () => {
		vi.spyOn(Date, 'now').mockReturnValue(2_500_000)
		serveDetail(
			protocolDetail({
				name: 'Nest',
				documentedData: chartData([{ label: 'documented', data: [chartPoint(1000, 1004)] }]),
				supplyMetrics: {
					maxSupply: 1854,
					adjustedSupply: 1854,
					tbdAmount: 850,
					incentiveAmount: 0,
					nonIncentiveAmount: 1004
				}
			})
		)

		const result = await queries.getProtocolEmissons('nest', {
			skipAvailabilityCheck: true,
			tokenlist: {}
		})

		expect(result.meta).toMatchObject({ circSupply: 1004, maxSupply: 1004, totalLocked: 0 })
	})

	test('keeps the earliest actionable next event regardless of source ordering', async () => {
		const nowSec = 1_800_000_000
		vi.spyOn(Date, 'now').mockReturnValue(nowSec * 1000)
		const unknownCliff: EmissionEvent = {
			description: 'Unknown cliff',
			category: 'insiders',
			unlockType: 'cliff',
			timestamp: nowSec + 20,
			noOfTokens: [],
			hasUnknownTokenAmount: true
		}
		const rateStop: EmissionEvent = {
			description: 'Rate stop',
			category: 'farming',
			unlockType: 'linear',
			timestamp: nowSec + 10,
			noOfTokens: [7, 0],
			rateDurationDays: 1
		}
		serveDetail(
			protocolDetail({
				name: 'Unsorted',
				events: [unknownCliff, cliff(nowSec + 5, -10), rateStop],
				documentedData: chartData([{ label: 'team', data: [chartPoint(1, 10)] }])
			})
		)

		const result = await queries.getProtocolEmissons('unsorted', {
			skipAvailabilityCheck: true,
			tokenlist: {}
		})

		expect(result.upcomingEvent).toEqual([rateStop])
	})

	test('returns renderable raw and grouped forecast sections without exposing metadata-only TBD sections', async () => {
		serveDetail(
			protocolDetailV2(
				{
					name: 'Canton',
					token: 'coingecko:canton',
					documentedData: chartData([
						{ label: 'app rewards', data: [chartPoint(1, 10)] },
						{ label: 'projected rewards', data: [chartPoint(1, 4, true)] }
					]),
					realTimeData: chartData(),
					categories: {
						farming: ['App Rewards'],
						noncirculating: ['Unscheduled Reserve (TBD)']
					}
				},
				{
					sections: {
						'App Rewards': componentSection('App Rewards'),
						'Projected Rewards': componentSection('Projected Rewards', {
							isForecast: true,
							colorFrom: 'App Rewards'
						}),
						'Unscheduled Reserve (TBD)': componentSection('Unscheduled Reserve (TBD)', { isTBD: true })
					}
				}
			)
		)

		const result = await queries.getProtocolEmissons('canton', {
			skipAvailabilityCheck: true
		})

		expect(result.categoriesBreakdown).toEqual({
			farming: ['App Rewards'],
			'farming (forecast)': ['Projected Rewards']
		})
		expect(result.forecastSections).toEqual(['Projected Rewards', 'farming (forecast)'])
		expect(result.tbdSections).toEqual([])
		expect(result.stackColors.documented['Projected Rewards']).toBe(result.stackColors.documented['App Rewards'])
	})
})

describe('getAllProtocolEmissions', () => {
	test('preserves an aggregate source failure instead of returning an empty list', async () => {
		http.serve({ [ALL_API]: fixtureStatus(400) })

		await expect(queries.getAllProtocolEmissions({ getHistoricalPrices: false, tokenlist: {} })).rejects.toThrow(/400/)
	})

	test('builds historical price requests around the latest eligible past unlock', () => {
		const day = 86_400
		const nowSec = 1_700_000_000
		const lastPastEvent = Math.floor((nowSec - 8 * day) / 1800) * 1800
		const anchor = Math.floor(lastPastEvent / day) * day

		const result = buildUnlocksHistoricalPriceRequests(
			[
				{
					gecko_id: 'chainlink',
					events: [
						cliff(nowSec - 60 * day, 1),
						cliff(lastPastEvent, 2),
						cliff(nowSec - 8 * day + 3600, 3, 'farming'),
						cliff(nowSec + day, 4)
					]
				}
			],
			nowSec
		)

		expect(result.lastPastTimestampByCoinKey.get('coingecko:chainlink')).toBe(lastPastEvent)
		expect(result.priceReqs['coingecko:chainlink']).toEqual([
			anchor - 7 * day,
			anchor - 6 * day,
			anchor - 5 * day,
			anchor - 4 * day,
			anchor - 3 * day,
			anchor - 2 * day,
			anchor - day,
			anchor,
			anchor + day,
			anchor + 2 * day,
			anchor + 3 * day,
			anchor + 4 * day,
			anchor + 5 * day,
			anchor + 6 * day,
			anchor + 7 * day
		])
	})

	test('selects the latest known past unlock when a newer event has an unknown amount', () => {
		const nowSec = 1_700_000_000
		const knownPastEvent = Math.floor((nowSec - 10 * 86_400) / 1800) * 1800
		const result = buildUnlocksHistoricalPriceRequests(
			[
				{
					gecko_id: 'chainlink',
					events: [
						cliff(nowSec - 60 * 86_400, 1),
						cliff(knownPastEvent, 2),
						// A team cliff, so only the unknown amount (not the farming exclusion) disqualifies it.
						{ ...cliff(nowSec - 8 * 86_400, 0), noOfTokens: [], hasUnknownTokenAmount: true }
					]
				}
			],
			nowSec
		)

		expect(result.lastPastTimestampByCoinKey.get('coingecko:chainlink')).toBe(knownPastEvent)
		expect(result.priceReqs['coingecko:chainlink']).toHaveLength(15)
	})

	test('preserves the exact event timestamp while using its UTC day as the price-request anchor', () => {
		const nowSec = 1_700_000_000
		const exactTimestamp = nowSec - 10 * 86_400 + 917
		const result = buildUnlocksHistoricalPriceRequests(
			[
				{
					gecko_id: 'chainlink',
					events: [cliff(nowSec - 20 * 86_400, 1), cliff(exactTimestamp, 2)]
				}
			],
			nowSec
		)

		expect(result.lastPastTimestampByCoinKey.get('coingecko:chainlink')).toBe(exactTimestamp)
		expect(result.priceReqs['coingecko:chainlink']?.[7]).toBe(Math.floor(exactTimestamp / 86_400) * 86_400)
	})

	test('uses tokenlist prices without fetching current coin prices', async () => {
		const nowSec = Date.now() / 1000
		serveAll([
			protocolEmission({
				name: 'Chainlink',
				token: 'coingecko:chainlink',
				geckoId: 'chainlink',
				events: [cliff(nowSec + 3600, 10)]
			})
		])

		const result = await queries.getAllProtocolEmissions({
			getHistoricalPrices: false,
			tokenlist: {
				chainlink: {
					current_price: 7.89,
					symbol: 'link'
				}
			}
		})

		expect(http.urls()).toEqual([ALL_API])
		expect(result).toHaveLength(1)
		expect(result[0]).toMatchObject({
			tPrice: 7.89,
			tSymbol: 'LINK'
		})
	})

	test('keeps unknown token amounts visible at a shared upcoming timestamp', async () => {
		const nowSec = 1_700_000_000
		const upcomingTimestamp = nowSec + 3600
		const dateNow = vi.spyOn(Date, 'now').mockReturnValue(nowSec * 1000)
		const knownEvent = cliff(upcomingTimestamp, 10)
		const unknownEvent = unknownLinear(upcomingTimestamp)
		serveAll([
			protocolEmission({
				name: 'Chainlink',
				token: 'coingecko:chainlink',
				geckoId: 'chainlink',
				events: [knownEvent, unknownEvent]
			})
		])

		const result = await queries.getAllProtocolEmissions({
			getHistoricalPrices: false,
			tokenlist: { chainlink: { current_price: 7.89, symbol: 'link' } }
		})
		dateNow.mockRestore()

		expect(result[0]?.upcomingEvent).toEqual([knownEvent, unknownEvent])
	})

	test('uses artifact historical prices without fetching historical coin prices', async () => {
		const day = 86_400
		const nowSec = 1_700_000_000
		const lastPastEvent = Math.floor((nowSec - 8 * day) / 1800) * 1800
		const dateNow = vi.spyOn(Date, 'now').mockReturnValue(nowSec * 1000)

		serveAll([
			protocolEmission({
				name: 'Chainlink',
				token: 'coingecko:chainlink',
				geckoId: 'chainlink',
				events: [cliff(nowSec - 60 * day, 1), cliff(lastPastEvent, 10), cliff(nowSec + day, 20)]
			})
		])

		const emissionsHistoricalPrices = {
			'coingecko:chainlink': {
				prices: [
					{ timestamp: lastPastEvent - day, price: 5 },
					{ timestamp: lastPastEvent + day, price: 10 }
				]
			}
		}
		const result = await queries.getAllProtocolEmissions({
			tokenlist: {
				chainlink: {
					current_price: 7.89,
					symbol: 'link'
				}
			},
			emissionsHistoricalPrices
		})

		dateNow.mockRestore()

		expect(http.urls()).toEqual([ALL_API])
		expect(result[0]?.lastEvent).toEqual([cliff(lastPastEvent, 10)])
		expect(result[0]?.historicalPrice).toEqual([
			[(lastPastEvent - day) * 1000, 5],
			[(lastPastEvent + day) * 1000, 10]
		])
		expect(emissionsHistoricalPrices['coingecko:chainlink'].prices).toEqual([
			{ timestamp: lastPastEvent - day, price: 5 },
			{ timestamp: lastPastEvent + day, price: 10 }
		])
	})

	test('falls back to network historical prices when the artifact cache is empty', async () => {
		const day = 86_400
		const nowSec = 1_700_000_000
		const lastPastEvent = Math.floor((nowSec - 8 * day) / 1800) * 1800
		const dateNow = vi.spyOn(Date, 'now').mockReturnValue(nowSec * 1000)

		http.serve({
			[HISTORICAL_PRICES_API]: {
				coins: { 'coingecko:chainlink': { prices: [{ timestamp: lastPastEvent, price: 2 }] } }
			}
		})
		serveAll([
			protocolEmission({
				name: 'Chainlink',
				token: 'coingecko:chainlink',
				geckoId: 'chainlink',
				events: [cliff(nowSec - 60 * day, 1), cliff(lastPastEvent, 10)]
			})
		])

		const result = await queries.getAllProtocolEmissions({
			tokenlist: {
				chainlink: {
					current_price: 7.89,
					symbol: 'link'
				}
			},
			emissionsHistoricalPrices: {}
		})

		dateNow.mockRestore()

		expect(http.urls().filter((url) => url.startsWith(HISTORICAL_PRICES_API))).toHaveLength(1)
		expect(result[0]?.historicalPrice).toEqual([[lastPastEvent * 1000, 2]])
	})

	test('falls back to network current and historical prices when cache options are omitted', async () => {
		const day = 86_400
		const nowSec = 1_700_000_000
		const lastPastEvent = Math.floor((nowSec - 8 * day) / 1800) * 1800
		const dateNow = vi.spyOn(Date, 'now').mockReturnValue(nowSec * 1000)

		http.serve({
			[CURRENT_PRICES_API]: {
				coins: { 'coingecko:chainlink': { price: 3, symbol: 'LINK', confidence: 1, timestamp: nowSec } }
			},
			[HISTORICAL_PRICES_API]: {
				coins: { 'coingecko:chainlink': { prices: [{ timestamp: lastPastEvent, price: 2 }] } }
			}
		})
		serveAll([
			protocolEmission({
				name: 'Chainlink',
				token: 'coingecko:chainlink',
				geckoId: 'chainlink',
				events: [cliff(nowSec - 60 * day, 1), cliff(lastPastEvent, 10), cliff(nowSec + day, 20)]
			})
		])

		const result = await queries.getAllProtocolEmissions()

		dateNow.mockRestore()

		expect(http.urls()).toContain(`${CURRENT_PRICES_API}coingecko:chainlink`)
		expect(result[0]).toMatchObject({
			tPrice: 3,
			tSymbol: 'LINK',
			historicalPrice: [[lastPastEvent * 1000, 2]]
		})
	})
})

describe('getUnlocksCalendarStaticPropsData', () => {
	test('indexes UTC days once and applies cliff, linear, zero, and unknown amount semantics', async () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2026-08-08T12:00:00Z'))
		http.serve({
			[CURRENT_PRICES_API]: {
				coins: { 'coingecko:test-token': { price: 2, symbol: 'TST', confidence: 1, timestamp: 1 } }
			}
		})
		serveAll([
			protocolEmission({
				name: 'Test Protocol',
				token: 'coingecko:test-token',
				geckoId: 'test-token',
				events: [
					{
						description: 'Cliff',
						category: 'insiders',
						unlockType: 'cliff',
						timestamp: Date.parse('2026-08-08T04:00:00Z') / 1000,
						noOfTokens: [10]
					},
					{
						description: 'Same-day cliff',
						category: 'insiders',
						unlockType: 'cliff',
						timestamp: Date.parse('2026-08-09T04:00:00Z') / 1000,
						noOfTokens: [1]
					},
					{
						description: 'Weekly rate decreases',
						category: 'farming',
						unlockType: 'linear',
						timestamp: Date.parse('2026-08-09T04:00:00Z') / 1000,
						noOfTokens: [100, 5],
						rateDurationDays: 7
					},
					{
						description: 'Unknown',
						category: 'farming',
						unlockType: 'linear',
						timestamp: Date.parse('2026-08-10T04:00:00Z') / 1000,
						noOfTokens: [],
						rateDurationDays: 7,
						hasUnknownTokenAmount: true
					},
					{
						description: 'Known zero',
						category: 'publicSale',
						unlockType: 'cliff',
						timestamp: Date.parse('2026-08-11T04:00:00Z') / 1000,
						noOfTokens: [0]
					},
					{
						description: 'Negative correction',
						category: 'publicSale',
						unlockType: 'cliff',
						timestamp: Date.parse('2026-08-12T04:00:00Z') / 1000,
						noOfTokens: [-5]
					}
				]
			})
		])

		const result = await queries.getUnlocksCalendarStaticPropsData()

		expect(result.unlocksData['2026-08-08']?.totalValue).toBe(20)
		expect(result.unlocksData['2026-08-09']?.totalValue).toBe(2)
		expect(result.unlocksData['2026-08-09']?.events).toMatchObject([{ value: 2 }, { value: 10, unit: 'week' }])
		expect(result.unlocksData['2026-08-10']).toBeUndefined()
		expect(result.unlocksData['2026-08-11']).toBeUndefined()
		expect(result.unlocksData['2026-08-12']).toBeUndefined()
		expect(result.precomputedData.monthlyMaxValues['2026-07']).toBe(20)
		expect(result.precomputedData.listEvents['2026-08-08']).toHaveLength(3)
	})
})
