import { describe, expect, it } from 'vitest'
import type { ProtocolLite } from '~/containers/ProtocolLists/api.types'
import { protocolMatchesForkFilter, toFilterProtocol, toStrikeTvl } from '../utils'

const protocolMetadata = (overrides: Partial<{ displayName: string; chains: string[] }> = {}) => ({
	displayName: 'Protocol',
	chains: ['Ethereum'],
	...overrides
})

const liteProtocol = (overrides: Partial<ProtocolLite> = {}): ProtocolLite => ({
	name: 'Protocol',
	symbol: 'PROTOCOL',
	logo: null,
	url: 'https://example.com',
	category: 'Dexes',
	chains: ['Ethereum'],
	chainTvls: {},
	tvl: 0,
	tvlPrevDay: 0,
	tvlPrevWeek: 0,
	tvlPrevMonth: 0,
	mcap: null,
	defillamaId: 'protocol',
	geckoId: null,
	...overrides
})

describe('ProtocolRankings filter helpers', () => {
	it('keeps protocols with display metadata on all-chain views', () => {
		expect(
			toFilterProtocol({
				protocolMetadata: protocolMetadata(),
				protocolData: liteProtocol(),
				chainDisplayName: 'All'
			})
		).toBe(true)
	})

	it('keeps protocols when either metadata or protocol data includes the selected chain', () => {
		expect(
			toFilterProtocol({
				protocolMetadata: protocolMetadata({ chains: ['Optimism'] }),
				protocolData: liteProtocol({ chains: ['Ethereum'] }),
				chainDisplayName: 'Ethereum'
			})
		).toBe(true)
	})

	it('filters protocols with excluded categories, missing display names, or missing metadata chains', () => {
		expect(
			toFilterProtocol({
				protocolMetadata: protocolMetadata(),
				protocolData: liteProtocol({ category: 'Canonical Bridge' }),
				chainDisplayName: 'All'
			})
		).toBe(false)
		expect(
			toFilterProtocol({
				protocolMetadata: protocolMetadata({ displayName: '' }),
				protocolData: liteProtocol(),
				chainDisplayName: 'All'
			})
		).toBe(false)
		expect(
			toFilterProtocol({
				protocolMetadata: { displayName: 'Protocol' },
				protocolData: liteProtocol(),
				chainDisplayName: 'All'
			})
		).toBe(false)
	})

	it('matches fork filters by normalized fork names', () => {
		expect(protocolMatchesForkFilter({ protocol: liteProtocol(), normalizedFork: null })).toBe(true)
		expect(
			protocolMatchesForkFilter({
				protocol: liteProtocol({ forkedFrom: ['Uniswap V2'] }),
				normalizedFork: 'uniswap-v2'
			})
		).toBe(true)
		expect(protocolMatchesForkFilter({ protocol: liteProtocol(), normalizedFork: 'uniswap-v2' })).toBe(false)
		expect(
			protocolMatchesForkFilter({
				protocol: liteProtocol({ forkedFrom: ['Curve'] }),
				normalizedFork: 'uniswap-v2'
			})
		).toBe(false)
	})
})

describe('ProtocolRankings TVL helpers', () => {
	it('strikes protocol rows in categories removed from chain TVL', () => {
		expect(toStrikeTvl(liteProtocol({ category: 'Bridge' }), {})).toBe(true)
	})

	it('strikes protocol rows that expose liquid staking or double counted TVL sections', () => {
		expect(toStrikeTvl(liteProtocol(), { liquidstaking: true })).toBe(true)
		expect(toStrikeTvl(liteProtocol(), { doublecounted: true })).toBe(true)
	})

	it('does not strike ordinary protocol rows without removed categories or extra TVL sections', () => {
		expect(toStrikeTvl(liteProtocol(), {})).toBe(false)
	})
})
