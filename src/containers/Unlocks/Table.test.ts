import { describe, expect, it } from 'vitest'
import type { EmissionEvent } from './api.types'
import { filterUnlockTableProtocols, type IEmission, parseUnlockFilterValue } from './Table'

const ALL_UNLOCK_TYPES = [
	'publicSale',
	'privateSale',
	'insiders',
	'airdrop',
	'farming',
	'noncirculating',
	'liquidity',
	'uncategorized'
]

const protocol = (
	name: string,
	price: number | null,
	mcap: number | undefined,
	events: IEmission['upcomingEvent']
): IEmission => {
	let cliffAmount = 0
	let linearAmount = 0
	let unknownEventCount = 0
	for (const event of events) {
		if ('hasUnknownTokenAmount' in event) unknownEventCount += 1
		else if (event.unlockType === 'cliff') cliffAmount += Math.max(event.noOfTokens[0], 0)
		else linearAmount += Math.max(event.noOfTokens[1], 0) / 7
	}
	const next24h = {
		cliff: cliffAmount,
		linear: linearAmount,
		total: cliffAmount + linearAmount,
		unknownEventCount
	}

	return {
		sources: [],
		protocolId: null,
		circSupply: 0,
		circSupply30d: 0,
		totalLocked: 0,
		maxSupply: 0,
		unlocksPerDay: next24h.total,
		next24h,
		token: `coingecko:${name.toLowerCase()}`,
		events,
		unlockEvents: null,
		lastEvent: [],
		historicalPrice: [],
		tSymbol: name.toUpperCase(),
		...(mcap !== undefined ? { mcap } : {}),
		name,
		tPrice: price,
		upcomingEvent: events
	}
}

const cliff = (description: string, category: string, timestamp: number, amount: number): EmissionEvent => ({
	description,
	category,
	unlockType: 'cliff',
	timestamp,
	noOfTokens: [amount]
})

const linear = (
	description: string,
	category: string,
	timestamp: number,
	previousRate: number,
	newRate: number
): EmissionEvent => ({
	description,
	category,
	unlockType: 'linear',
	timestamp,
	noOfTokens: [previousRate, newRate],
	rateDurationDays: 7
})

const unknown = (description: string, category: string, timestamp: number): EmissionEvent => ({
	description,
	category,
	unlockType: 'cliff',
	timestamp,
	noOfTokens: [],
	hasUnknownTokenAmount: true
})

const options = (overrides: Partial<Parameters<typeof filterUnlockTableProtocols>[1]> = {}) => ({
	showOnlyWatchlist: false,
	savedProtocols: new Set<string>(),
	allUnlockTypes: ALL_UNLOCK_TYPES,
	selectedUnlockTypes: ALL_UNLOCK_TYPES,
	minUnlockValue: null,
	maxUnlockValue: null,
	minPerc: '' as const,
	maxPerc: '' as const,
	...overrides
})

describe('unlock table construction behavior fixture', () => {
	it('returns the input array and rows when no filter is active', () => {
		const alpha = protocol('Alpha', 2, 1_000, [cliff('Team', 'insiders', 1, 10)])
		const protocols = [alpha]
		const result = filterUnlockTableProtocols(protocols, options())

		expect(result).toBe(protocols)
		expect(result[0]).toBe(alpha)
	})

	it('retains row identity for watchlist-only and value-only filters', () => {
		const alpha = protocol('Alpha', 2, 1_000, [cliff('Team', 'insiders', 1, 10)])
		const beta = protocol('Beta', 1, 100, [cliff('Sale', 'privateSale', 2, 5)])

		const watchlist = filterUnlockTableProtocols(
			[alpha, beta],
			options({ showOnlyWatchlist: true, savedProtocols: new Set(['Alpha']) })
		)
		const value = filterUnlockTableProtocols([alpha, beta], options({ minUnlockValue: 5, maxUnlockValue: 20 }))

		expect(watchlist).toEqual([alpha])
		expect(watchlist[0]).toBe(alpha)
		expect(value).toEqual([alpha, beta])
		expect(value[0]).toBe(alpha)
		expect(value[1]).toBe(beta)
	})

	it('retains identity when every event survives and clones only a partially filtered row', () => {
		const alphaEvents: IEmission['upcomingEvent'] = [
			cliff('Team', 'insiders', 1, 10),
			cliff('Advisors', 'insiders', 2, 5)
		]
		const betaEvents: IEmission['upcomingEvent'] = [
			cliff('Sale', 'privateSale', 3, 20),
			cliff('Farm', 'farming', 4, 30)
		]
		const alpha = protocol('Alpha', 2, 1_000, alphaEvents)
		const beta = protocol('Beta', 1, 100, betaEvents)
		const input = [alpha, beta]

		const result = filterUnlockTableProtocols(input, options({ selectedUnlockTypes: ['insiders', 'privateSale'] }))

		expect(result[0]).toBe(alpha)
		expect(result[1]).not.toBe(beta)
		expect(result[1]!.upcomingEvent).toEqual([betaEvents[0]])
		expect(input).toEqual([alpha, beta])
		expect(beta.upcomingEvent).toBe(betaEvents)
	})

	it('combines filters using the integrated next-24h value', () => {
		const alphaEvents: IEmission['upcomingEvent'] = [
			linear('Team', 'insiders', 1, 10, 15),
			cliff('Farm', 'farming', 2, 100)
		]
		const gammaEvents: IEmission['upcomingEvent'] = [
			cliff('Advisors', 'insiders', 5, 15),
			cliff('Public', 'publicSale', 6, 10)
		]
		const alpha = protocol('Alpha', 2, 1_000, alphaEvents)
		const beta = protocol('Beta', 1, 100, [cliff('Sale', 'privateSale', 3, 50)])
		const gamma = protocol('Gamma', 2, 1_000, gammaEvents)
		const inputSnapshot = structuredClone([alpha, beta, gamma])

		const result = filterUnlockTableProtocols(
			[alpha, beta, gamma],
			options({
				showOnlyWatchlist: true,
				savedProtocols: new Set(['Gamma', 'Alpha']),
				selectedUnlockTypes: ['insiders'],
				minUnlockValue: 45,
				maxUnlockValue: 55,
				minPerc: 4,
				maxPerc: 6
			})
		)

		expect(result.map((row) => row.name)).toEqual(['Gamma'])
		expect(result.map((row) => row.upcomingEvent[0]!.description)).toEqual(['Advisors'])
		expect([alpha, beta, gamma]).toEqual(inputSnapshot)
	})

	it('keeps inclusive value and percentage boundaries', () => {
		const exact = protocol('Exact', 2, 1_000, [cliff('Exact', 'insiders', 1, 10)])

		const result = filterUnlockTableProtocols(
			[exact],
			options({ minUnlockValue: 20, maxUnlockValue: 20, minPerc: 2, maxPerc: 2 })
		)

		expect(result).toEqual([exact])
		expect(result[0]).toBe(exact)
	})

	it('filters on known values while excluding rows without required market data', () => {
		const ignoredEvents: IEmission['upcomingEvent'] = [
			unknown('Unknown amount', 'insiders', 1),
			cliff('Known zero', 'insiders', 2, 0),
			cliff('Negative correction', 'insiders', 3, -10)
		]
		const missingPrice = protocol('Missing price', null, 100, ignoredEvents)
		const missingMcap = protocol('Missing mcap', 2, undefined, ignoredEvents)
		const zeroMcap = protocol('Zero mcap', 2, 0, ignoredEvents)
		const negativeMcap = protocol('Negative mcap', 2, -1, ignoredEvents)
		const knownSubtotalZero = protocol('Known subtotal zero', 2, 100, ignoredEvents)
		const knownZero = protocol('Known zero', 2, 100, [cliff('Known zero', 'insiders', 2, 0)])

		expect(
			filterUnlockTableProtocols([missingPrice, missingMcap, zeroMcap, negativeMcap], options({ minUnlockValue: 1 }))
		).toEqual([])
		expect(
			filterUnlockTableProtocols(
				[missingPrice, missingMcap, zeroMcap, negativeMcap, knownSubtotalZero, knownZero],
				options({ minPerc: 0, maxPerc: 0 })
			)
		).toEqual([knownSubtotalZero, knownZero])
	})

	it('normalizes malformed and non-finite numeric query values once', () => {
		expect(parseUnlockFilterValue(undefined)).toBe('')
		expect(parseUnlockFilterValue(['1'])).toBe('')
		expect(parseUnlockFilterValue('')).toBe('')
		expect(parseUnlockFilterValue('oops')).toBe('')
		expect(parseUnlockFilterValue('Infinity')).toBe('')
		expect(parseUnlockFilterValue('25.5')).toBe(25.5)
		expect(parseUnlockFilterValue('0')).toBe(0)
	})
})
