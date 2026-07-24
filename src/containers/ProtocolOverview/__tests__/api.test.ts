import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchProtocolOverviewMetrics, fetchProtocolTreasuryChart, fetchProtocolTvlChart } from '../api'

const fetchJsonMock = vi.hoisted(() => vi.fn())

vi.mock('~/utils/async', async (importOriginal) => {
	const actual = await importOriginal<typeof import('~/utils/async')>()
	return {
		...actual,
		fetchJson: fetchJsonMock
	}
})

describe('ProtocolOverview API chart fetchers', () => {
	beforeEach(() => {
		fetchJsonMock.mockReset()
	})

	it('fetches and normalizes TVL value charts from the TVL namespace', async () => {
		fetchJsonMock.mockResolvedValue([
			[1, 10],
			[2, 20]
		])

		const result = await fetchProtocolTvlChart({ protocol: 'aave', key: 'pool2', currency: 'ETH' })

		const url = String(fetchJsonMock.mock.calls[0][0])
		expect(url).toContain('/chart/tvl/protocol/aave?key=pool2&currency=ETH')
		expect(url).not.toContain('/chart/treasury/')
		expect(result).toEqual([
			[1000, 10],
			[2000, 20]
		])
	})

	it('keeps embedded hack amounts in whole USD and gives them explicit domain names', async () => {
		fetchJsonMock.mockResolvedValue({
			id: 'aave',
			raises: [
				{
					date: 1_737_331_200,
					name: 'Aave',
					round: 'Series A',
					amount: 16,
					chains: ['Ethereum'],
					sector: 'DeFi',
					category: 'Lending',
					categoryGroup: 'DeFi',
					leadInvestors: [],
					otherInvestors: [],
					valuation: '300'
				}
			],
			hacks: [
				{
					date: 1_773_273_600,
					name: 'Aave V3',
					classification: 'Protocol Logic',
					technique: null,
					amount: 862_000,
					chain: ['Ethereum'],
					bridgeHack: false,
					targetType: 'DeFi Protocol',
					returnedFunds: 862_000,
					defillamaId: '1599',
					language: null
				}
			]
		})

		const result = await fetchProtocolOverviewMetrics('aave')

		expect(result.hacks?.[0]).toMatchObject({ amountUsd: 862_000, returnedFundsUsd: 862_000 })
		expect(result.hacks?.[0]).not.toHaveProperty('amount')
		expect(result.raises?.[0]).toMatchObject({ amountUsd: 16_000_000, valuationUsd: 300_000_000 })
		expect(result.raises?.[0]).not.toHaveProperty('amount')
		expect(result.raises?.[0]).not.toHaveProperty('valuation')
	})

	it('fetches and normalizes TVL chain breakdown charts from the TVL namespace', async () => {
		fetchJsonMock.mockResolvedValue([
			[1, { Ethereum: 10 }],
			[2, { Ethereum: 20 }]
		])

		const result = await fetchProtocolTvlChart({
			protocol: 'aave',
			breakdownType: 'chain-breakdown',
			tokensToExclude: ['GT']
		})

		const url = String(fetchJsonMock.mock.calls[0][0])
		expect(url).toContain('/chart/tvl/protocol/aave/chain-breakdown?tokensToExclude=GT')
		expect(url).not.toContain('/chart/treasury/')
		expect(result).toEqual([
			[1000, { Ethereum: 10 }],
			[2000, { Ethereum: 20 }]
		])
	})

	it('fetches and normalizes treasury token breakdown charts from the treasury namespace', async () => {
		fetchJsonMock.mockResolvedValue([
			[1, { MKR: 10 }],
			[2, { MKR: 20 }]
		])

		const result = await fetchProtocolTreasuryChart({
			protocol: 'makerdao',
			key: 'ownTokens',
			currency: 'token',
			breakdownType: 'token-breakdown'
		})

		const url = String(fetchJsonMock.mock.calls[0][0])
		expect(url).toContain('/chart/treasury/protocol/makerdao/token-breakdown?key=ownTokens&currency=token')
		expect(url).not.toContain('/chart/tvl/')
		expect(result).toEqual([
			[1000, { MKR: 10 }],
			[2000, { MKR: 20 }]
		])
	})
})
