import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	fetchJson: vi.fn(),
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
	fetchJson: mocks.fetchJson
}))

beforeEach(() => {
	vi.resetModules()
	mocks.fetchJson.mockReset()
	mocks.datasetsServerUrl = 'https://datasets.example.com'
	mocks.serverUrl = 'https://api.example.com'
})

describe('unlocks api', () => {
	it('fetches protocol emission details from the datasets endpoint', async () => {
		mocks.fetchJson.mockResolvedValue({
			name: 'Chainlink',
			metadata: {
				events: [
					{ timestamp: 100, noOfTokens: [1] },
					{ timestamp: '200', noOfTokens: [2, null] }
				]
			},
			documentedData: { data: [] }
		})

		const api = await import('../api')
		const result = await api.fetchProtocolEmission('chain/link')

		expect(mocks.fetchJson).toHaveBeenCalledWith('https://datasets.example.com/emissions/chain%2Flink')
		expect(mocks.fetchJson).toHaveBeenCalledTimes(1)
		expect(result?.name).toBe('Chainlink')
		expect(result?.metadata?.events).toEqual([
			{ timestamp: 100, noOfTokens: [1] },
			{ timestamp: 200, noOfTokens: [], hasUnknownTokenAmount: true }
		])
	})

	it('returns null when the datasets emission request fails', async () => {
		mocks.fetchJson.mockRejectedValue(new Error('not found'))

		const api = await import('../api')
		const result = await api.fetchProtocolEmission('chainlink')

		expect(result).toBeNull()
		expect(mocks.fetchJson).toHaveBeenCalledTimes(1)
	})

	it('normalizes numeric-string event timestamps once at the list API boundary', async () => {
		const normalizedProtocol = {
			name: 'Already normalized',
			token: 'NORMAL',
			events: [{ timestamp: 300, noOfTokens: [3] }]
		}
		mocks.fetchJson.mockResolvedValue([
			{
				name: 'Chainlink',
				token: 'LINK',
				events: [
					{ timestamp: 100, noOfTokens: [1] },
					{ timestamp: '200', noOfTokens: [2, null] }
				]
			},
			normalizedProtocol
		])

		const api = await import('../api')
		const result = await api.fetchAllProtocolEmissions()

		expect(result[0]?.events).toEqual([
			{ timestamp: 100, noOfTokens: [1] },
			{ timestamp: 200, noOfTokens: [], hasUnknownTokenAmount: true }
		])
		expect(result[1]).toBe(normalizedProtocol)
		expect(result[1]?.events).toBe(normalizedProtocol.events)
	})
})
