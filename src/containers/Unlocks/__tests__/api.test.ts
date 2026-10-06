import { describe, expect, test } from 'vitest'
import { DATASETS_SERVER_URL, SERVER_URL } from '~/constants'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import type { ProtocolEmission, RawProtocolEmission, RawProtocolEmissionDetail } from '../api.types'

const http = installFixtureFetch()

describe('unlocks api', () => {
	test('normalizes a protocol detail into chart events', async () => {
		const rawDetail = {
			name: 'Chainlink',
			gecko_id: 'chainlink',
			pId: 'chainlink',
			defillamaIds: ['chainlink'],
			chainName: 'Ethereum',
			categories: { insiders: ['Team'] },
			unlockUsdChart: [],
			metadata: {
				token: 'coingecko:chainlink',
				protocolIds: ['chainlink'],
				unlockEvents: [
					{
						timestamp: 200,
						cliffAllocations: [],
						linearAllocations: [
							{
								recipient: 'Team',
								category: 'insiders',
								unlockType: 'linear_rate_change',
								previousRatePerWeek: 2,
								newRatePerWeek: null,
								endTimestamp: '300'
							}
						],
						summary: { netChangeInWeeklyRate: null }
					}
				],
				events: [
					{
						timestamp: 100,
						noOfTokens: [1],
						description: 'Team cliff',
						category: 'insiders',
						unlockType: 'cliff'
					},
					{
						timestamp: '200',
						noOfTokens: [2, null],
						description: 'Team rate change',
						category: 'insiders',
						unlockType: 'linear',
						rateDurationDays: 30
					},
					{
						timestamp: '250',
						noOfTokens: [null, 7],
						description: 'Known new rate',
						category: 'farming',
						unlockType: 'linear',
						rateDurationDays: 7
					}
				]
			},
			documentedData: {
				data: [],
				tokenAllocation: {
					current: {},
					final: {},
					progress: {},
					bySection: { current: {}, final: {}, progress: {} }
				}
			}
		} satisfies RawProtocolEmissionDetail

		http.serve({ [`${DATASETS_SERVER_URL}/emissions/chain%2Flink`]: rawDetail })

		const api = await import('../api')
		const result = await api.fetchProtocolEmission('chain/link')

		expect(result).not.toBeNull()
		if (!result) throw new Error('Expected protocol detail')
		expect(result.name).toBe('Chainlink')
		expect(result.metadata.events).toEqual([
			{
				timestamp: 100,
				noOfTokens: [1],
				description: 'Team cliff',
				category: 'insiders',
				unlockType: 'cliff'
			},
			{
				timestamp: 200,
				noOfTokens: [],
				description: 'Team rate change',
				category: 'insiders',
				unlockType: 'linear',
				rateDurationDays: 30,
				hasUnknownTokenAmount: true
			},
			{
				timestamp: 250,
				noOfTokens: [null, 7],
				description: 'Known new rate',
				category: 'farming',
				unlockType: 'linear',
				rateDurationDays: 7
			}
		])
		expect(result.metadata.unlockEvents[0]?.linearAllocations[0]?.endTimestamp).toBe(300)
	})

	test('preserves a failed detail request as a failure', async () => {
		const error = new Error('upstream unavailable')
		http.serve({
			[DATASETS_SERVER_URL]: () => {
				throw error
			}
		})

		const api = await import('../api')

		await expect(api.fetchProtocolEmission('chainlink')).rejects.toBe(error)
	})

	test('returns null only for a missing protocol detail', async () => {
		http.serve({ [DATASETS_SERVER_URL]: fixtureStatus(404) })

		const api = await import('../api')

		await expect(api.fetchProtocolEmission('missing')).resolves.toBeNull()
	})

	test('throws for a non-not-found HTTP response', async () => {
		http.serve({ [DATASETS_SERVER_URL]: fixtureStatus(503) })

		const api = await import('../api')

		await expect(api.fetchProtocolEmission('chainlink')).rejects.toThrow('[503]')
	})

	test('normalizes numeric-string event timestamps once at the list API boundary', async () => {
		const aggregateFields = {
			sources: [],
			protocolId: 'chainlink',
			protocolSlug: 'chainlink',
			gecko_id: 'chainlink',
			circSupply: 10,
			circSupply30d: 9,
			totalLocked: 90,
			maxSupply: 100,
			unlocksPerDay: 1,
			unlockEvents: []
		}
		const normalizedProtocol: ProtocolEmission = {
			...aggregateFields,
			name: 'Already normalized',
			token: 'NORMAL',
			events: [
				{
					timestamp: 300,
					noOfTokens: [3],
					description: 'Normalized cliff',
					category: 'publicSale',
					unlockType: 'cliff'
				}
			]
		}
		const rawProtocol = {
			...aggregateFields,
			name: 'Chainlink',
			token: 'LINK',
			unlockEvents: [
				{
					timestamp: 200,
					cliffAllocations: [],
					linearAllocations: [
						{
							recipient: 'Team',
							category: 'insiders',
							unlockType: 'linear_rate_change',
							previousRatePerWeek: 2,
							newRatePerWeek: 3,
							endTimestamp: '400'
						}
					],
					summary: { netChangeInWeeklyRate: 1 }
				}
			],
			events: [
				{
					timestamp: 100,
					noOfTokens: [1],
					description: 'Team cliff',
					category: 'insiders',
					unlockType: 'cliff'
				},
				{
					timestamp: '200',
					noOfTokens: [2, null],
					description: 'Team rate change',
					category: 'insiders',
					unlockType: 'linear',
					rateDurationDays: 30
				},
				{
					timestamp: '250',
					noOfTokens: [null, 7],
					description: 'Known new rate',
					category: 'farming',
					unlockType: 'linear',
					rateDurationDays: 7
				}
			]
		} satisfies RawProtocolEmission
		http.serve({ [`${SERVER_URL}/emissions`]: [rawProtocol, normalizedProtocol] })

		const api = await import('../api')
		const result = await api.fetchAllProtocolEmissions()

		expect(result[0]?.events).toEqual([
			{
				timestamp: 100,
				noOfTokens: [1],
				description: 'Team cliff',
				category: 'insiders',
				unlockType: 'cliff'
			},
			{
				timestamp: 200,
				noOfTokens: [],
				description: 'Team rate change',
				category: 'insiders',
				unlockType: 'linear',
				rateDurationDays: 30,
				hasUnknownTokenAmount: true
			},
			{
				timestamp: 250,
				noOfTokens: [null, 7],
				description: 'Known new rate',
				category: 'farming',
				unlockType: 'linear',
				rateDurationDays: 7
			}
		])
		expect(result[1]).toEqual(normalizedProtocol)
		expect(result[0]?.unlockEvents[0]?.linearAllocations[0]?.endTimestamp).toBe(400)
	})

	test('preserves a failed aggregate request as a failure', async () => {
		const error = new Error('Failed to fetch')
		http.serve({
			[SERVER_URL]: () => {
				throw error
			},
			[DATASETS_SERVER_URL]: () => {
				throw error
			}
		})

		const api = await import('../api')

		await expect(api.fetchAllProtocolEmissions()).rejects.toThrow(error.message)
	})

	test('keeps a successful empty aggregate distinct from failure', async () => {
		http.serve({ [`${SERVER_URL}/emissions`]: [] })

		const api = await import('../api')

		await expect(api.fetchAllProtocolEmissions()).resolves.toEqual([])
	})

	test('preserves a failed protocol-list request as a failure', async () => {
		const error = new Error('metadata unavailable')
		http.serve({
			[SERVER_URL]: () => {
				throw error
			},
			[DATASETS_SERVER_URL]: () => {
				throw error
			}
		})

		const api = await import('../api')

		await expect(api.fetchEmissionsProtocolsList()).rejects.toThrow(error.message)
	})
})
