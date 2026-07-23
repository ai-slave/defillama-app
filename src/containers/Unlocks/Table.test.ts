import { describe, expect, it } from 'vitest'
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
	mcap: number | null,
	events: IEmission['upcomingEvent']
): IEmission =>
	({
		name,
		tPrice: price,
		mcap,
		upcomingEvent: events
	}) as IEmission

const options = (overrides: Partial<Parameters<typeof filterUnlockTableProtocols>[1]> = {}) => ({
	showOnlyWatchlist: false,
	savedProtocols: new Set<string>(),
	selectedUnlockTypes: ALL_UNLOCK_TYPES,
	minUnlockValue: null,
	maxUnlockValue: null,
	minPerc: '' as const,
	maxPerc: '' as const,
	...overrides
})

describe('unlock table construction behavior fixture', () => {
	it('returns the input array and rows when no filter is active', () => {
		const alpha = protocol('Alpha', 2, 1_000, [
			{ description: 'Team', category: 'insiders', timestamp: 1, noOfTokens: [10] }
		])
		const protocols = [alpha]
		const result = filterUnlockTableProtocols(protocols, options())

		expect(result).toBe(protocols)
		expect(result[0]).toBe(alpha)
	})

	it('retains row identity for watchlist-only and value-only filters', () => {
		const alpha = protocol('Alpha', 2, 1_000, [
			{ description: 'Team', category: 'insiders', timestamp: 1, noOfTokens: [10] }
		])
		const beta = protocol('Beta', 1, 100, [
			{ description: 'Sale', category: 'privateSale', timestamp: 2, noOfTokens: [5] }
		])

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
			{ description: 'Team', category: 'insiders', timestamp: 1, noOfTokens: [10] },
			{ description: 'Advisors', category: 'insiders', timestamp: 2, noOfTokens: [5] }
		]
		const betaEvents: IEmission['upcomingEvent'] = [
			{ description: 'Sale', category: 'privateSale', timestamp: 3, noOfTokens: [20] },
			{ description: 'Farm', category: 'farming', timestamp: 4, noOfTokens: [30] }
		]
		const alpha = protocol('Alpha', 2, 1_000, alphaEvents)
		const beta = protocol('Beta', 1, 100, betaEvents)
		const input = [alpha, beta]

		const result = filterUnlockTableProtocols(input, options({ selectedUnlockTypes: ['insiders', 'privateSale'] }))

		expect(result[0]).toBe(alpha)
		expect(result[1]).not.toBe(beta)
		expect(result[1].upcomingEvent).toEqual([betaEvents[0]])
		expect(input).toEqual([alpha, beta])
		expect(beta.upcomingEvent).toBe(betaEvents)
	})

	it('combines category, watchlist, value, and percentage filters without changing encounter order', () => {
		const alphaEvents: IEmission['upcomingEvent'] = [
			{ description: 'Team', category: 'insiders', timestamp: 1, noOfTokens: [10, 5] },
			{ description: 'Farm', category: 'farming', timestamp: 2, noOfTokens: [100] }
		]
		const gammaEvents: IEmission['upcomingEvent'] = [
			{ description: 'Advisors', category: 'insiders', timestamp: 5, noOfTokens: [15] },
			{ description: 'Public', category: 'publicSale', timestamp: 6, noOfTokens: [10] }
		]
		const alpha = protocol('Alpha', 2, 1_000, alphaEvents)
		const beta = protocol('Beta', 1, 100, [
			{ description: 'Sale', category: 'privateSale', timestamp: 3, noOfTokens: [50] }
		])
		const gamma = protocol('Gamma', 2, 1_000, gammaEvents)
		const inputSnapshot = structuredClone([alpha, beta, gamma])

		const result = filterUnlockTableProtocols(
			[alpha, beta, gamma],
			options({
				showOnlyWatchlist: true,
				savedProtocols: new Set(['Gamma', 'Alpha']),
				selectedUnlockTypes: ['insiders'],
				minUnlockValue: 25,
				maxUnlockValue: 35,
				minPerc: 2,
				maxPerc: 4
			})
		)

		expect(result.map((row) => row.name)).toEqual(['Alpha', 'Gamma'])
		expect(result.map((row) => row.upcomingEvent[0].description)).toEqual(['Team', 'Advisors'])
		expect([alpha, beta, gamma]).toEqual(inputSnapshot)
	})

	it('keeps inclusive value and percentage boundaries', () => {
		const exact = protocol('Exact', 2, 1_000, [
			{ description: 'Exact', category: 'insiders', timestamp: 1, noOfTokens: [10] }
		])

		const result = filterUnlockTableProtocols(
			[exact],
			options({ minUnlockValue: 20, maxUnlockValue: 20, minPerc: 2, maxPerc: 2 })
		)

		expect(result).toEqual([exact])
		expect(result[0]).toBe(exact)
	})

	it('preserves null-event, empty-token, missing-price, and non-positive-market-cap rules', () => {
		const ignoredEvents: IEmission['upcomingEvent'] = [
			{ description: 'No date', category: 'insiders', timestamp: null, noOfTokens: [10] },
			{ description: 'No tokens', category: 'insiders', timestamp: 1, noOfTokens: [] }
		]
		const missingPrice = protocol('Missing price', null, 100, ignoredEvents)
		const missingMcap = protocol('Missing mcap', 2, null, ignoredEvents)
		const zeroMcap = protocol('Zero mcap', 2, 0, ignoredEvents)
		const negativeMcap = protocol('Negative mcap', 2, -1, ignoredEvents)

		expect(
			filterUnlockTableProtocols([missingPrice, missingMcap, zeroMcap, negativeMcap], options({ minUnlockValue: 1 }))
		).toEqual([])
		expect(
			filterUnlockTableProtocols(
				[missingPrice, missingMcap, zeroMcap, negativeMcap],
				options({ minPerc: 0, maxPerc: 0 })
			)
		).toEqual([missingPrice, missingMcap, zeroMcap, negativeMcap])
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
