import { describe, expect, test } from 'vitest'
import { getActiveAddressesCumulativeNotice, getEmbeddedChainChartSettings } from '../embeddedChartSettings'
import type { IChainOverviewData } from '../types'

const arbitrum = {
	charts: ['TVL', 'Chain Fees', 'Active Addresses'],
	chainTokenInfo: {
		gecko_id: 'arbitrum',
		token_symbol: 'ARB',
		current_price: null,
		market_cap: null,
		fully_diluted_valuation: null
	},
	metadata: { id: 'arbitrum', name: 'Arbitrum', gasTokenGeckoId: 'ethereum', gasTokenSymbol: 'ETH' }
} as unknown as Pick<IChainOverviewData, 'charts' | 'chainTokenInfo' | 'metadata'>

describe('embedded chain chart settings', () => {
	test('reads TVL include params as booleans', () => {
		expect(
			getEmbeddedChainChartSettings({ include_staking_in_tvl: 'yes', include_pool2_in_tvl: 'false' }, arbitrum)
				.tvlSettings
		).toEqual({
			pool2: false,
			staking: true,
			borrowed: false,
			doublecounted: false,
			liquidstaking: false,
			vesting: false,
			govtokens: false
		})
	})

	test.each([
		['eth', 'ETH'],
		['ARB', 'USD'],
		[['ETH'], 'USD']
	])('accepts only a supported single currency: %s', (currency, denomination) => {
		expect(getEmbeddedChainChartSettings({ currency }, arbitrum)).toMatchObject({
			chainGeckoId: 'arbitrum',
			denomination
		})
	})

	test('keeps the first chart on unless disabled and other charts off unless enabled', () => {
		expect(getEmbeddedChainChartSettings({}, arbitrum).toggledCharts).toEqual(['TVL'])
		expect(getEmbeddedChainChartSettings({ tvl: 'false', chainFees: 'true' }, arbitrum).toggledCharts).toEqual([
			'Chain Fees'
		])
	})

	test('groups only when a bar chart is shown and falls back to daily for unknown intervals', () => {
		expect(getEmbeddedChainChartSettings({ groupBy: 'weekly' }, arbitrum).groupBy).toBe('daily')
		expect(getEmbeddedChainChartSettings({ chainFees: 'true', groupBy: 'Weekly' }, arbitrum).groupBy).toBe('weekly')
		expect(getEmbeddedChainChartSettings({ chainFees: 'true', groupBy: 'hourly' }, arbitrum).groupBy).toBe('daily')
	})
})

describe('active addresses cumulative notice', () => {
	test('fills the chart when active addresses is the only cumulative series', () => {
		expect(getActiveAddressesCumulativeNotice('cumulative', ['Active Addresses'])).toBe('fill')
	})

	test('sits above the chart when other series remain', () => {
		expect(getActiveAddressesCumulativeNotice('cumulative', ['TVL', 'Active Addresses'])).toBe('inline')
	})

	test('does not show outside cumulative or without active addresses', () => {
		expect(getActiveAddressesCumulativeNotice('weekly', ['Active Addresses'])).toBeNull()
		expect(getActiveAddressesCumulativeNotice('cumulative', ['TVL'])).toBeNull()
	})
})
