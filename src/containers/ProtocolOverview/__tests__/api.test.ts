import { describe, expect, test } from 'vitest'
import { V2_SERVER_URL } from '~/constants'
import { fixtureStatus, installFixtureFetch } from '~/utils/test/fixtureFetch'
import { fetchProtocolOverviewMetrics, fetchProtocolTreasuryChart, fetchProtocolTvlChart } from '../api'
import type { IProtocolMetricsV2Api } from '../api.types'

const http = installFixtureFetch()
const standaloneMetricsFixture = {
	id: 'curve',
	name: 'Curve DEX',
	symbol: 'CRV',
	url: 'https://curve.fi',
	description: null,
	logo: null,
	gecko_id: 'curve-dao-token',
	cmcId: null,
	chains: ['Ethereum'],
	currentChainTvls: { Ethereum: 0 },
	mcap: null,
	category: 'Dexes',
	tags: ['Dexes'],
	chain: 'Ethereum',
	module: 'curve/index.js',
	hacks: [],
	raises: []
} satisfies IProtocolMetricsV2Api

describe('ProtocolOverview API chart fetchers', () => {
	const getFetchedUrl = () => http.urls()[0]

	test('fetches and normalizes TVL value charts from the TVL namespace', async () => {
		http.serve({
			[V2_SERVER_URL]: [
				[1, 10],
				[2, 20]
			]
		})

		const result = await fetchProtocolTvlChart({ protocol: 'aave', key: 'pool2' })

		const url = getFetchedUrl()
		expect(url).toContain('/chart/tvl/protocol/aave?key=pool2')
		expect(url).not.toContain('/chart/treasury/')
		expect(result).toEqual([
			[1000, 10],
			[2000, 20]
		])
	})

	test('preserves an empty successful chart and lets upstream failures reject', async () => {
		http.serve({ [V2_SERVER_URL]: [] })
		await expect(fetchProtocolTvlChart({ protocol: 'aave' })).resolves.toEqual([])

		http.serve({ [V2_SERVER_URL]: fixtureStatus(404) })
		await expect(fetchProtocolTvlChart({ protocol: 'aave' })).rejects.toThrow('[404]')
	})

	test('canonicalizes empty, duplicate, and reordered direct TVL exclusions', async () => {
		http.serve({ [V2_SERVER_URL]: [] })

		await fetchProtocolTvlChart({ protocol: 'aave', tokensToExclude: ['', 'MNT', 'GT', 'MNT', ''] })
		await fetchProtocolTvlChart({ protocol: 'aave', tokensToExclude: ['GT', 'MNT'] })
		await fetchProtocolTvlChart({ protocol: 'aave', tokensToExclude: ['', ''] })
		await fetchProtocolTvlChart({ protocol: 'aave' })

		const urls = http.urls()
		expect(urls[0]).toBe(urls[1])
		expect(urls[0]).toContain('tokensToExclude=GT%2CMNT')
		expect(urls[2]).toBe(urls[3])
		expect(urls[2]).not.toContain('tokensToExclude')
	})

	test('keeps embedded hack amounts in whole USD and gives them explicit domain names', async () => {
		const metrics = {
			...standaloneMetricsFixture,
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
					valuation: '300',
					source: ''
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
					language: null,
					source: ''
				}
			]
		} satisfies IProtocolMetricsV2Api
		http.serve({ [V2_SERVER_URL]: metrics })

		const result = await fetchProtocolOverviewMetrics('aave')

		expect(result.hacks?.[0]).toMatchObject({ amountUsd: 862_000, returnedFundsUsd: 862_000 })
		expect(result.hacks?.[0]).not.toHaveProperty('amount')
		expect(result.raises?.[0]).toMatchObject({ amountUsd: 16_000_000, valuationUsd: 300_000_000 })
		expect(result.raises?.[0]).not.toHaveProperty('amount')
		expect(result.raises?.[0]).not.toHaveProperty('valuation')
	})

	test('fetches and normalizes TVL chain breakdown charts from the TVL namespace', async () => {
		http.serve({
			[V2_SERVER_URL]: [
				[1, { Ethereum: 10 }],
				[2, { Ethereum: 20 }]
			]
		})

		const result = await fetchProtocolTvlChart({
			protocol: 'aave',
			breakdownType: 'chain-breakdown',
			tokensToExclude: ['GT']
		})

		const url = getFetchedUrl()
		expect(url).toContain('/chart/tvl/protocol/aave/chain-breakdown?tokensToExclude=GT')
		expect(url).not.toContain('/chart/treasury/')
		expect(result).toEqual([
			[1000, { Ethereum: 10 }],
			[2000, { Ethereum: 20 }]
		])
	})

	test('fetches and normalizes treasury token breakdown charts from the treasury namespace', async () => {
		http.serve({
			[V2_SERVER_URL]: [
				[1, { MKR: 10 }],
				[2, { MKR: 20 }]
			]
		})

		const result = await fetchProtocolTreasuryChart({
			protocol: 'makerdao',
			key: 'OwnTokens',
			currency: 'token',
			breakdownType: 'token-breakdown'
		})

		const url = getFetchedUrl()
		expect(url).toContain('/chart/treasury/protocol/makerdao/token-breakdown?key=OwnTokens&currency=token')
		expect(url).not.toContain('/chart/tvl/')
		expect(result).toEqual([
			[1000, { MKR: 10 }],
			[2000, { MKR: 20 }]
		])
	})
})
