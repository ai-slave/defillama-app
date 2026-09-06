import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { ProtocolEmission, RawProtocolEmission, RawProtocolEmissionDetail } from '../api.types'

const mocks = vi.hoisted(() => ({
	fetchJson: vi.fn(),
	fetchWithPoolingOnServer: vi.fn(),
	datasetsServerUrl: 'https://datasets.example.com',
	serverUrl: 'https://api.example.com'
}))

vi.mock('~/constants', () => ({
	get DATASETS_SERVER_URL() {
		return mocks.datasetsServerUrl
	},
	get SERVER_URL() {
		return mocks.serverUrl
	}
}))

vi.mock('~/utils/async', () => ({
	fetchJson: mocks.fetchJson,
	getSlowJsonTimeoutMs: () => 45_000,
	handleFetchResponse: async (response: Response) => {
		throw new Error(`request failed: ${response.status}`)
	}
}))

vi.mock('~/utils/http-client', () => ({
	fetchWithPoolingOnServer: mocks.fetchWithPoolingOnServer
}))

function jsonResponse(status: number, body: object): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	})
}

beforeEach(() => {
	vi.resetModules()
	mocks.fetchJson.mockReset()
	mocks.fetchWithPoolingOnServer.mockReset()
	mocks.datasetsServerUrl = 'https://datasets.example.com'
	mocks.serverUrl = 'https://api.example.com'
})

describe('unlocks api', () => {
	test('fetches protocol emission details from the datasets endpoint', async () => {
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

		mocks.fetchWithPoolingOnServer.mockResolvedValue(jsonResponse(200, rawDetail))

		const api = await import('../api')
		const result = await api.fetchProtocolEmission('chain/link')

		expect(mocks.fetchWithPoolingOnServer).toHaveBeenCalledWith('https://datasets.example.com/emissions/chain%2Flink', {
			timeout: 45_000
		})
		expect(mocks.fetchWithPoolingOnServer).toHaveBeenCalledTimes(1)
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
		mocks.fetchWithPoolingOnServer.mockRejectedValue(error)

		const api = await import('../api')

		await expect(api.fetchProtocolEmission('chainlink')).rejects.toBe(error)
		expect(mocks.fetchWithPoolingOnServer).toHaveBeenCalledTimes(1)
	})

	test('returns null only for a missing protocol detail', async () => {
		mocks.fetchWithPoolingOnServer.mockResolvedValue(jsonResponse(404, {}))

		const api = await import('../api')

		await expect(api.fetchProtocolEmission('missing')).resolves.toBeNull()
	})

	test('throws for a non-not-found HTTP response', async () => {
		mocks.fetchWithPoolingOnServer.mockResolvedValue(jsonResponse(503, {}))

		const api = await import('../api')

		await expect(api.fetchProtocolEmission('chainlink')).rejects.toThrow('request failed: 503')
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
		mocks.fetchJson.mockResolvedValue([rawProtocol, normalizedProtocol])

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
		expect(result[1]).toBe(normalizedProtocol)
		expect(result[1]?.events).toBe(normalizedProtocol.events)
		expect(result[0]?.unlockEvents[0]?.linearAllocations[0]?.endTimestamp).toBe(400)
	})

	test('preserves a failed aggregate request as a failure', async () => {
		const error = new Error('Failed to fetch')
		mocks.fetchJson.mockRejectedValue(error)

		const api = await import('../api')

		await expect(api.fetchAllProtocolEmissions()).rejects.toBe(error)
	})

	test('keeps a successful empty aggregate distinct from failure', async () => {
		mocks.fetchJson.mockResolvedValue([])

		const api = await import('../api')

		await expect(api.fetchAllProtocolEmissions()).resolves.toEqual([])
	})

	test('preserves a failed protocol-list request as a failure', async () => {
		const error = new Error('metadata unavailable')
		mocks.fetchJson.mockRejectedValue(error)

		const api = await import('../api')

		await expect(api.fetchEmissionsProtocolsList()).rejects.toBe(error)
	})
})
