import { describe, expect, test } from 'vitest'
import type { ProtocolLite } from '~/containers/ProtocolLists/api.types'
import { getSearchExpandedRows, protocolMatchesForkFilter, toFilterProtocol, toStrikeTvl } from '../utils'

const protocolMetadata = (overrides: Partial<{ displayName: string; chains: Array<string> }> = {}) => ({
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
	test('keeps protocols with display metadata on all-chain views', () => {
		expect(
			toFilterProtocol({
				protocolMetadata: protocolMetadata(),
				protocolData: liteProtocol(),
				chainDisplayName: 'All'
			})
		).toBe(true)
	})

	test('keeps protocols when either metadata or protocol data includes the selected chain', () => {
		expect(
			toFilterProtocol({
				protocolMetadata: protocolMetadata({ chains: ['Optimism'] }),
				protocolData: liteProtocol({ chains: ['Ethereum'] }),
				chainDisplayName: 'Ethereum'
			})
		).toBe(true)
	})

	test('filters protocols with excluded categories, missing display names, or missing metadata chains', () => {
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

	test('matches fork filters by normalized fork names', () => {
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
	test('strikes protocol rows in categories removed from chain TVL', () => {
		expect(toStrikeTvl(liteProtocol({ category: 'Bridge' }), {})).toBe(true)
	})

	test('strikes protocol rows that expose liquid staking or double counted TVL sections', () => {
		expect(toStrikeTvl(liteProtocol(), { liquidstaking: true })).toBe(true)
		expect(toStrikeTvl(liteProtocol(), { doublecounted: true })).toBe(true)
	})

	test('does not strike ordinary protocol rows without removed categories or extra TVL sections', () => {
		expect(toStrikeTvl(liteProtocol(), {})).toBe(false)
	})
})

describe('ProtocolRankings search expansion', () => {
	const child = { id: 'stable-child', name: 'Stable Child', slug: 'stable-child' }
	const rows = [
		{ id: 'parent', name: 'Unrelated Parent', slug: 'parent', childProtocols: [child] },
		{ id: 'stable-parent', name: 'Stable Parent', slug: 'stable-parent', childProtocols: [child] },
		{ name: 'Idless Parent', slug: 'idless', childProtocols: [child] },
		{ id: 'solo', name: 'Solo', slug: 'solo' }
	] as Array<Parameters<typeof getSearchExpandedRows>[0][number]>

	test('opens parents that a search reached only through their children', () => {
		expect(getSearchExpandedRows(rows, '  STAB ')).toEqual({ parent: true, 'root:idless': true })
	})

	test('leaves expansion to the user without a search', () => {
		expect(getSearchExpandedRows(rows, ' ')).toBeNull()
	})
})
