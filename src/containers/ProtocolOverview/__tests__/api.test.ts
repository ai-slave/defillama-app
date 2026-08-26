import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchProtocolOverviewMetrics, fetchProtocolTreasuryChart, fetchProtocolTvlChart } from '../api'
import type { IProtocolMetricsV2Api } from '../api.types'

const fetchJsonMock = vi.hoisted(() => vi.fn())

vi.mock('~/utils/async', async (importOriginal) => {
	const actual = await importOriginal<typeof import('~/utils/async')>()
	return {
		...actual,
		fetchJson: fetchJsonMock
	}
})

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
	const getFetchedUrl = () => {
		const call = fetchJsonMock.mock.calls[0]
		if (!call) throw new Error('Expected fetchJson to be called')
		return String(call[0])
	}

	beforeEach(() => {
		fetchJsonMock.mockReset()
	})

	it('fetches and normalizes TVL value charts from the TVL namespace', async () => {
		fetchJsonMock.mockResolvedValue([
			[1, 10],
			[2, 20]
		])

		const result = await fetchProtocolTvlChart({ protocol: 'aave', key: 'pool2' })

		const url = getFetchedUrl()
		expect(url).toContain('/chart/tvl/protocol/aave?key=pool2')
		expect(url).not.toContain('/chart/treasury/')
		expect(result).toEqual([
			[1000, 10],
			[2000, 20]
		])
	})

	it('preserves an empty successful chart and lets upstream failures reject', async () => {
		fetchJsonMock.mockResolvedValueOnce([])
		await expect(fetchProtocolTvlChart({ protocol: 'aave' })).resolves.toEqual([])

		fetchJsonMock.mockRejectedValueOnce(new Error('upstream unavailable'))
		await expect(fetchProtocolTvlChart({ protocol: 'aave' })).rejects.toThrow('upstream unavailable')
	})

	it('canonicalizes empty, duplicate, and reordered direct TVL exclusions', async () => {
		fetchJsonMock.mockResolvedValue([])

		await fetchProtocolTvlChart({ protocol: 'aave', tokensToExclude: ['', 'MNT', 'GT', 'MNT', ''] })
		await fetchProtocolTvlChart({ protocol: 'aave', tokensToExclude: ['GT', 'MNT'] })
		await fetchProtocolTvlChart({ protocol: 'aave', tokensToExclude: ['', ''] })
		await fetchProtocolTvlChart({ protocol: 'aave' })

		const urls = fetchJsonMock.mock.calls.map((call) => String(call[0]))
		expect(urls[0]).toBe(urls[1])
		expect(urls[0]).toContain('tokensToExclude=GT%2CMNT')
		expect(urls[2]).toBe(urls[3])
		expect(urls[2]).not.toContain('tokensToExclude')
	})

	it('keeps embedded hack amounts in whole USD and gives them explicit domain names', async () => {
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
					language: null,
					source: ''
				}
			]
		} satisfies IProtocolMetricsV2Api
		fetchJsonMock.mockResolvedValue(metrics)

		const result = await fetchProtocolOverviewMetrics('aave')

		expect(result.hacks?.[0]).toMatchObject({ amountUsd: 862_000, returnedFundsUsd: 862_000 })
		expect(result.hacks?.[0]).not.toHaveProperty('amount')
		expect(result.raises?.[0]).toMatchObject({ amountUsd: 16_000_000, valuationUsd: 300_000_000 })
		expect(result.raises?.[0]).not.toHaveProperty('amount')
		expect(result.raises?.[0]).not.toHaveProperty('valuation')
	})

	it('preserves parent and child identity, explicit nulls, and zero chain values', async () => {
		const parentFixture = {
			id: 'parent#aave',
			name: 'Aave',
			isParentProtocol: true,
			address: null,
			symbol: 'AAVE',
			url: 'https://aave.com',
			description: 'Aave liquidity markets',
			logo: 'https://icons.llama.fi/aave.jpg',
			gecko_id: 'aave',
			cmcId: null,
			chains: ['Ethereum'],
			currentChainTvls: { Ethereum: 0 },
			mcap: null,
			twitter: null,
			treasury: null,
			otherProtocols: ['aave-v3'],
			hacks: [],
			raises: []
		} satisfies IProtocolMetricsV2Api
		const childFixture = {
			id: '1599',
			name: 'Aave V3',
			symbol: 'AAVE',
			url: 'https://aave.com',
			description: null,
			logo: null,
			gecko_id: 'aave',
			cmcId: null,
			chains: ['Ethereum'],
			currentChainTvls: { Ethereum: 0 },
			mcap: null,
			category: 'Lending',
			tags: ['Money Market'],
			chain: 'Ethereum',
			module: 'aave-v3/index.js',
			parentProtocol: 'parent#aave',
			parentProtocolSlug: 'aave',
			hacks: [],
			raises: []
		} satisfies IProtocolMetricsV2Api
		const { parentProtocolSlug: registrySlug, ...childWithoutRegistrySlugBase } = childFixture
		expect(registrySlug).toBe('aave')
		const childWithoutRegistrySlugFixture = {
			...childWithoutRegistrySlugBase,
			id: '1600',
			name: 'Aave V2',
			module: 'aave/index.js'
		} satisfies IProtocolMetricsV2Api
		fetchJsonMock
			.mockResolvedValueOnce(parentFixture)
			.mockResolvedValueOnce(childFixture)
			.mockResolvedValueOnce(standaloneMetricsFixture)
			.mockResolvedValueOnce(childWithoutRegistrySlugFixture)

		const parent = await fetchProtocolOverviewMetrics('aave')
		const child = await fetchProtocolOverviewMetrics('aave-v3')
		const standalone = await fetchProtocolOverviewMetrics('curve')
		const childWithoutRegistrySlug = await fetchProtocolOverviewMetrics('aave-v2')

		expect(parent).toMatchObject({
			isParentProtocol: true,
			address: null,
			description: 'Aave liquidity markets',
			logo: 'https://icons.llama.fi/aave.jpg',
			twitter: null,
			treasury: null,
			currentChainTvls: { Ethereum: 0 }
		})
		expect(parent).not.toHaveProperty('parentProtocol')
		expect(child).toMatchObject({
			parentProtocol: 'parent#aave',
			parentProtocolSlug: 'aave',
			category: 'Lending',
			tags: ['Money Market'],
			currentChainTvls: { Ethereum: 0 }
		})
		expect(child).not.toHaveProperty('isParentProtocol')
		expect(standalone).toMatchObject({ tags: ['Dexes'], chain: 'Ethereum', module: 'curve/index.js' })
		expect(standalone).not.toHaveProperty('parentProtocol')
		expect(childWithoutRegistrySlug).toMatchObject({ parentProtocol: 'parent#aave', module: 'aave/index.js' })
		expect(childWithoutRegistrySlug).not.toHaveProperty('parentProtocolSlug')
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

		const url = getFetchedUrl()
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
