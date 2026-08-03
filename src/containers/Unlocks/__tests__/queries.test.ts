import { afterEach, describe, expect, it, vi } from 'vitest'

const fetchProtocolEmissionMock = vi.fn<(...args: unknown[]) => Promise<any>>()
const fetchAllProtocolEmissionsMock = vi.fn<(...args: unknown[]) => Promise<any[]>>(() => Promise.resolve([]))
const fetchCoinPricesMock = vi.fn<(...args: unknown[]) => Promise<Record<string, unknown>>>(() => Promise.resolve({}))
const fetchJsonMock = vi.fn<(...args: unknown[]) => Promise<unknown>>(() => Promise.resolve([]))
const batchFetchHistoricalPricesMock = vi.fn<(...args: unknown[]) => Promise<{ results: Record<string, unknown> }>>(
	() => Promise.resolve({ results: {} })
)

vi.mock('~/api/pricing', () => ({
	fetchCoinPrices: (...args: unknown[]) => fetchCoinPricesMock(...args)
}))

vi.mock('~/utils', () => ({
	batchFetchHistoricalPrices: (...args: unknown[]) => batchFetchHistoricalPricesMock(...args),
	capitalizeFirstLetter: (value: string) => value.charAt(0).toUpperCase() + value.slice(1),
	getNDistinctColors: (count: number) => Array.from({ length: count }, (_, index) => `#${index}`),
	roundToNearestHalfHour: (timestamp: number) => timestamp
}))

vi.mock('~/utils/async', () => ({
	fetchJson: (...args: unknown[]) => fetchJsonMock(...args),
	getSlowJsonTimeoutMs: () => 1000
}))

vi.mock('../api', () => ({
	fetchProtocolEmission: (...args: unknown[]) => fetchProtocolEmissionMock(...args),
	fetchAllProtocolEmissions: (...args: unknown[]) => fetchAllProtocolEmissionsMock(...args)
}))

import { buildUnlocksHistoricalPriceRequests } from '~/utils/unlocks/historicalPriceRequests'
import {
	buildUnlockTypesByTimestamp,
	getAllProtocolEmissions,
	getProtocolEmissionsPieData,
	getProtocolEmissons,
	isEmptyProtocolEmissionResult
} from '../queries'

describe('buildUnlockTypesByTimestamp', () => {
	it('classifies an ascending event stream in one pass without mutating it', () => {
		const day = 86_400
		const nowSec = 1_700_000_000
		vi.spyOn(Date, 'now').mockReturnValue(nowSec * 1000)
		const events = [
			{ timestamp: nowSec - day, noOfTokens: [1] },
			{ timestamp: nowSec + day, noOfTokens: [1] },
			{ timestamp: nowSec + 8 * day, noOfTokens: [1] },
			{ timestamp: nowSec + 38 * day, noOfTokens: [1] },
			{ timestamp: nowSec + 128 * day, noOfTokens: [1] }
		]
		const timestamps = events.map((event) => event.timestamp)
		const result = buildUnlockTypesByTimestamp(events)
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
	afterEach(() => {
		fetchProtocolEmissionMock.mockReset()
		fetchAllProtocolEmissionsMock.mockReset()
	})

	const protocolDetail = {
		name: 'Curve Finance',
		metadata: { token: 'CRV', events: [] },
		documentedData: {
			data: [{ label: 'team', data: [{ timestamp: 1, unlocked: 10 }] }]
		},
		realTimeData: { data: [] }
	}

	it('builds allocation data without fetching global supply metadata', async () => {
		fetchProtocolEmissionMock.mockResolvedValue(protocolDetail)

		const result = await getProtocolEmissionsPieData('curve-finance', false)

		expect(result.pieChartData.documented).toEqual([{ name: 'Team', value: 10 }])
		expect(result.meta).toEqual({})
		expect(fetchAllProtocolEmissionsMock).not.toHaveBeenCalled()
	})

	it('fetches supply metadata for the locked/unlocked chart', async () => {
		fetchProtocolEmissionMock.mockResolvedValue(protocolDetail)
		fetchAllProtocolEmissionsMock.mockResolvedValue([
			{ name: 'Curve Finance', token: 'CRV', totalLocked: 25, maxSupply: 100 }
		])

		const result = await getProtocolEmissionsPieData('curve-finance', true)

		expect(fetchAllProtocolEmissionsMock).toHaveBeenCalledTimes(1)
		expect(result.meta).toMatchObject({ totalLocked: 25, maxSupply: 100 })
	})
})

describe('getProtocolEmissons', () => {
	afterEach(() => {
		vi.restoreAllMocks()
		fetchProtocolEmissionMock.mockReset()
		fetchAllProtocolEmissionsMock.mockClear()
		fetchCoinPricesMock.mockClear()
		fetchJsonMock.mockClear()
		batchFetchHistoricalPricesMock.mockClear()
	})

	it('returns the empty result without fetching protocol data when the cached emissions list misses', async () => {
		const result = await getProtocolEmissons('chainlink', {
			emissionsProtocolsList: ['aave']
		})

		expect(isEmptyProtocolEmissionResult(result)).toBe(true)
		expect(fetchProtocolEmissionMock).not.toHaveBeenCalled()
		expect(fetchAllProtocolEmissionsMock).not.toHaveBeenCalled()
	})

	it('skips the availability check when explicitly told the slug is already valid', async () => {
		fetchProtocolEmissionMock.mockResolvedValue({
			name: 'Chainlink',
			gecko_id: 'chainlink',
			metadata: {
				events: [],
				token: 'coingecko:chainlink',
				notes: []
			},
			documentedData: {
				data: [
					{
						label: 'team',
						data: [{ timestamp: 1, unlocked: 10 }]
					}
				],
				tokenAllocation: {
					current: { Team: 10 },
					final: { Team: 10 }
				}
			},
			realTimeData: {
				data: [],
				tokenAllocation: { current: {}, final: {} }
			}
		})

		const result = await getProtocolEmissons('chainlink', {
			skipAvailabilityCheck: true
		})

		expect(fetchProtocolEmissionMock).toHaveBeenCalledWith('chainlink')
		expect(isEmptyProtocolEmissionResult(result)).toBe(false)
		expect(result.categories.documented).toEqual(['Team'])
		expect(result.tokenAllocation.documented).toEqual({ current: { Team: 10 }, final: { Team: 10 } })
		expect(result.tokenAllocation.realtime).toEqual({ current: {}, final: {} })
	})

	it('preserves the documented allocation split nested under bySection', async () => {
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
		fetchProtocolEmissionMock.mockResolvedValue({
			name: 'Aave',
			metadata: { events: [], token: 'coingecko:aave', notes: [] },
			documentedData: { data: [], tokenAllocation: allocation },
			realTimeData: { data: [], tokenAllocation: { current: {}, final: {} } }
		})

		const result = await getProtocolEmissons('aave', { skipAvailabilityCheck: true, tokenlist: {} })

		expect(result.tokenAllocation.documented).toEqual(allocation)
	})

	it('preserves the legacy flat allocation as both current and final allocation', async () => {
		const allocation = { Team: 20, Ecosystem: 80 }
		fetchProtocolEmissionMock.mockResolvedValue({
			name: 'Legacy',
			metadata: { events: [], notes: [] },
			documentedData: { data: [], tokenAllocation: allocation },
			realTimeData: { data: [], tokenAllocation: null }
		})

		const result = await getProtocolEmissons('legacy', { skipAvailabilityCheck: true, tokenlist: {} })

		expect(result.tokenAllocation.documented).toEqual({ current: allocation, final: allocation })
		expect(result.tokenAllocation.realtime).toEqual({ current: {}, final: {} })
	})

	it('uses tokenlist prices for protocol emissions without fetching current coin prices', async () => {
		fetchProtocolEmissionMock.mockResolvedValue({
			name: 'Chainlink',
			gecko_id: 'chainlink',
			metadata: {
				events: [],
				token: 'coingecko:chainlink',
				notes: []
			},
			documentedData: {
				data: [
					{
						label: 'team',
						data: [{ timestamp: 1, unlocked: 10 }]
					}
				],
				tokenAllocation: { current: {}, final: {} }
			},
			realTimeData: {
				data: [],
				tokenAllocation: { current: {}, final: {} }
			}
		})

		const result = await getProtocolEmissons('chainlink', {
			skipAvailabilityCheck: true,
			tokenlist: {
				chainlink: {
					current_price: 12.34,
					symbol: 'link'
				}
			}
		})

		expect(fetchCoinPricesMock).not.toHaveBeenCalled()
		expect(result.tokenPrice).toEqual({ price: 12.34, symbol: 'LINK' })
	})

	it('reuses colors across chained colorFrom remaps', async () => {
		fetchProtocolEmissionMock.mockResolvedValue({
			name: 'Chainlink',
			metadata: {
				events: [],
				token: 'coingecko:chainlink',
				notes: []
			},
			documentedData: {
				data: [
					{
						label: 'alpha',
						data: [{ timestamp: 1, unlocked: 10 }]
					},
					{
						label: 'charlie',
						data: [{ timestamp: 1, unlocked: 20 }]
					},
					{
						label: 'bravo',
						data: [{ timestamp: 1, unlocked: 30 }]
					}
				],
				tokenAllocation: {
					current: { Alpha: 10, Bravo: 30, Charlie: 20 },
					final: { Alpha: 10, Bravo: 30, Charlie: 20 }
				}
			},
			realTimeData: {
				data: [],
				tokenAllocation: { current: {}, final: {} }
			},
			componentData: {
				sections: {
					Alpha: {},
					Bravo: { colorFrom: 'Alpha' },
					Charlie: { colorFrom: 'Bravo' }
				}
			}
		})

		const result = await getProtocolEmissons('chainlink', {
			skipAvailabilityCheck: true
		})

		expect(result.stackColors.documented).toMatchObject({
			Alpha: '#0',
			Bravo: '#0',
			Charlie: '#0'
		})
	})

	it('returns renderable raw and grouped forecast sections without exposing metadata-only TBD sections', async () => {
		fetchProtocolEmissionMock.mockResolvedValue({
			name: 'Canton',
			metadata: { events: [], notes: [] },
			documentedData: {
				data: [
					{ label: 'app rewards', data: [{ timestamp: 1, unlocked: 10 }] },
					{ label: 'app rewards (forecast)', data: [{ timestamp: 1, unlocked: 4, isForecast: true }] }
				],
				tokenAllocation: { current: {}, final: {} }
			},
			realTimeData: { data: [], tokenAllocation: { current: {}, final: {} } },
			categories: {
				farming: ['App Rewards'],
				noncirculating: ['Unscheduled Reserve (TBD)']
			},
			componentData: {
				sections: {
					'App Rewards': {},
					'App Rewards (forecast)': { colorFrom: 'App Rewards' },
					'Unscheduled Reserve (TBD)': { isTBD: true }
				}
			}
		})

		const result = await getProtocolEmissons('canton', { skipAvailabilityCheck: true })

		expect(result.categoriesBreakdown).toEqual({
			farming: ['App Rewards'],
			'farming (forecast)': ['App Rewards (forecast)']
		})
		expect(result.forecastSections).toEqual(['App Rewards (forecast)', 'farming (forecast)'])
		expect(result.tbdSections).toEqual([])
	})
})

describe('getAllProtocolEmissions', () => {
	afterEach(() => {
		vi.restoreAllMocks()
		fetchAllProtocolEmissionsMock.mockReset()
		fetchProtocolEmissionMock.mockClear()
		fetchCoinPricesMock.mockClear()
		fetchJsonMock.mockClear()
		batchFetchHistoricalPricesMock.mockClear()
	})

	it('builds historical price requests around the latest eligible past unlock', () => {
		const day = 86_400
		const nowSec = 1_700_000_000
		const lastPastEvent = Math.floor((nowSec - 8 * day) / 1800) * 1800
		const anchor = Math.floor(lastPastEvent / day) * day

		const result = buildUnlocksHistoricalPriceRequests(
			[
				{
					name: 'Chainlink',
					token: 'coingecko:chainlink',
					gecko_id: 'chainlink',
					events: [
						{ timestamp: nowSec - 60 * day, noOfTokens: [1] },
						{ timestamp: lastPastEvent, noOfTokens: [2], category: 'team' },
						{ timestamp: nowSec - 8 * day + 3600, noOfTokens: [3], category: 'farming' },
						{ timestamp: nowSec + day, noOfTokens: [4] }
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

	it('selects the latest known past unlock when a newer event has an unknown amount', () => {
		const nowSec = 1_700_000_000
		const knownPastEvent = Math.floor((nowSec - 10 * 86_400) / 1800) * 1800
		const result = buildUnlocksHistoricalPriceRequests(
			[
				{
					gecko_id: 'chainlink',
					events: [
						{ timestamp: nowSec - 60 * 86_400, noOfTokens: [1] },
						{ timestamp: knownPastEvent, noOfTokens: [2] },
						{ timestamp: nowSec - 8 * 86_400, noOfTokens: [], hasUnknownTokenAmount: true }
					]
				}
			],
			nowSec
		)

		expect(result.lastPastTimestampByCoinKey.get('coingecko:chainlink')).toBe(knownPastEvent)
		expect(result.priceReqs['coingecko:chainlink']).toBeDefined()
	})

	it('uses tokenlist prices without fetching current coin prices', async () => {
		const nowSec = Date.now() / 1000
		fetchAllProtocolEmissionsMock.mockResolvedValue([
			{
				name: 'Chainlink',
				token: 'coingecko:chainlink',
				gecko_id: 'chainlink',
				events: [{ timestamp: nowSec + 3600, noOfTokens: [10] }]
			}
		])

		const result = await getAllProtocolEmissions({
			getHistoricalPrices: false,
			tokenlist: {
				chainlink: {
					current_price: 7.89,
					symbol: 'link'
				}
			}
		})

		expect(fetchCoinPricesMock).not.toHaveBeenCalled()
		expect(result).toHaveLength(1)
		expect(result[0]).toMatchObject({
			tPrice: 7.89,
			tSymbol: 'LINK'
		})
	})

	it('excludes unknown token amounts from a shared upcoming timestamp', async () => {
		const nowSec = 1_700_000_000
		const upcomingTimestamp = nowSec + 3600
		const dateNow = vi.spyOn(Date, 'now').mockReturnValue(nowSec * 1000)
		fetchAllProtocolEmissionsMock.mockResolvedValue([
			{
				name: 'Chainlink',
				token: 'coingecko:chainlink',
				gecko_id: 'chainlink',
				events: [
					{ timestamp: upcomingTimestamp, noOfTokens: [10], category: 'team' },
					{
						timestamp: upcomingTimestamp,
						noOfTokens: [],
						hasUnknownTokenAmount: true,
						unlockType: 'linear'
					}
				]
			}
		])

		const result = await getAllProtocolEmissions({
			getHistoricalPrices: false,
			tokenlist: { chainlink: { current_price: 7.89, symbol: 'link' } }
		})
		dateNow.mockRestore()

		expect(result[0]?.upcomingEvent).toEqual([{ timestamp: upcomingTimestamp, noOfTokens: [10], category: 'team' }])
	})

	it('uses artifact historical prices without fetching historical coin prices', async () => {
		const day = 86_400
		const nowSec = 1_700_000_000
		const lastPastEvent = Math.floor((nowSec - 8 * day) / 1800) * 1800
		const dateNow = vi.spyOn(Date, 'now').mockReturnValue(nowSec * 1000)

		fetchAllProtocolEmissionsMock.mockResolvedValue([
			{
				name: 'Chainlink',
				token: 'coingecko:chainlink',
				gecko_id: 'chainlink',
				events: [
					{ timestamp: nowSec - 60 * day, noOfTokens: [1], category: 'team' },
					{ timestamp: lastPastEvent, noOfTokens: [10], category: 'team' },
					{ timestamp: nowSec + day, noOfTokens: [20], category: 'team' }
				]
			}
		])

		const emissionsHistoricalPrices = {
			'coingecko:chainlink': {
				prices: [
					{ timestamp: lastPastEvent - day, price: 5 },
					{ timestamp: lastPastEvent + day, price: 10 }
				]
			}
		}
		const result = await getAllProtocolEmissions({
			tokenlist: {
				chainlink: {
					current_price: 7.89,
					symbol: 'link'
				}
			},
			emissionsHistoricalPrices
		})

		dateNow.mockRestore()

		expect(batchFetchHistoricalPricesMock).not.toHaveBeenCalled()
		expect(result[0]?.lastEvent).toEqual([{ timestamp: lastPastEvent, noOfTokens: [10], category: 'team' }])
		expect(result[0]?.historicalPrice).toEqual([
			[(lastPastEvent - day) * 1000, 5],
			[(lastPastEvent + day) * 1000, 10]
		])
		expect(emissionsHistoricalPrices['coingecko:chainlink'].prices).toEqual([
			{ timestamp: lastPastEvent - day, price: 5 },
			{ timestamp: lastPastEvent + day, price: 10 }
		])
	})

	it('falls back to network historical prices when the artifact cache is empty', async () => {
		const day = 86_400
		const nowSec = 1_700_000_000
		const lastPastEvent = Math.floor((nowSec - 8 * day) / 1800) * 1800
		const dateNow = vi.spyOn(Date, 'now').mockReturnValue(nowSec * 1000)

		batchFetchHistoricalPricesMock.mockResolvedValueOnce({
			results: {
				'coingecko:chainlink': {
					prices: [{ timestamp: lastPastEvent, price: 2 }]
				}
			}
		})
		fetchAllProtocolEmissionsMock.mockResolvedValue([
			{
				name: 'Chainlink',
				token: 'coingecko:chainlink',
				gecko_id: 'chainlink',
				events: [
					{ timestamp: nowSec - 60 * day, noOfTokens: [1], category: 'team' },
					{ timestamp: lastPastEvent, noOfTokens: [10], category: 'team' }
				]
			}
		])

		const result = await getAllProtocolEmissions({
			tokenlist: {
				chainlink: {
					current_price: 7.89,
					symbol: 'link'
				}
			},
			emissionsHistoricalPrices: {}
		})

		dateNow.mockRestore()

		expect(batchFetchHistoricalPricesMock).toHaveBeenCalledWith({
			'coingecko:chainlink': expect.any(Array)
		})
		expect(result[0]?.historicalPrice).toEqual([[lastPastEvent * 1000, 2]])
	})

	it('falls back to network current and historical prices when cache options are omitted', async () => {
		const day = 86_400
		const nowSec = 1_700_000_000
		const lastPastEvent = Math.floor((nowSec - 8 * day) / 1800) * 1800
		const dateNow = vi.spyOn(Date, 'now').mockReturnValue(nowSec * 1000)

		fetchJsonMock.mockResolvedValueOnce([])
		fetchCoinPricesMock.mockResolvedValueOnce({
			'coingecko:chainlink': {
				price: 3,
				symbol: 'LINK'
			}
		})
		batchFetchHistoricalPricesMock.mockResolvedValueOnce({
			results: {
				'coingecko:chainlink': {
					prices: [{ timestamp: lastPastEvent, price: 2 }]
				}
			}
		})
		fetchAllProtocolEmissionsMock.mockResolvedValue([
			{
				name: 'Chainlink',
				token: 'coingecko:chainlink',
				gecko_id: 'chainlink',
				events: [
					{ timestamp: nowSec - 60 * day, noOfTokens: [1], category: 'team' },
					{ timestamp: lastPastEvent, noOfTokens: [10], category: 'team' },
					{ timestamp: nowSec + day, noOfTokens: [20], category: 'team' }
				]
			}
		])

		const result = await getAllProtocolEmissions()

		dateNow.mockRestore()

		expect(fetchCoinPricesMock).toHaveBeenCalledWith(['coingecko:chainlink'])
		expect(batchFetchHistoricalPricesMock).toHaveBeenCalledWith(
			expect.objectContaining({
				'coingecko:chainlink': expect.any(Array)
			})
		)
		expect(result[0]).toMatchObject({
			tPrice: 3,
			tSymbol: 'LINK',
			historicalPrice: [[lastPastEvent * 1000, 2]]
		})
	})
})
