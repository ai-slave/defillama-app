import { describe, expect, test } from 'vitest'
import { CONFIG_API, SERVER_URL, STABLECOINS_SERVER_URL, V2_SERVER_URL } from '~/constants'
import { fixtureStatus, installFixtureFetch } from '~/utils/test/fixtureFetch'
import { fetchProChainChartData } from '../services/ChainCharts'

const http = installFixtureFetch()

describe('chain TVL', () => {
	test('rejects a failed chain source instead of returning a cacheable empty chart', async () => {
		http.serve({ [`${SERVER_URL}/lite/charts/Ethereum`]: fixtureStatus(404) })

		await expect(fetchProChainChartData('tvl', 'Ethereum')).rejects.toThrow(/404/)
	})
})

describe('chain Bridged TVL', () => {
	// The chain-asset id index is cached per module, so every test serves the same metadata.
	function serveChainAssets(chart: unknown = [{ timestamp: 1_700_000_000, data: { total: '42' } }]) {
		http.serve({
			[`${CONFIG_API}/smol/appMetadata-chains.json`]: {
				hyperliquid: { id: 'hyperliquid', name: 'Hyperliquid L1', chainAssets: true },
				optimism: { id: 'optimism', name: 'OP Mainnet', chainAssets: true },
				unknown: { id: 'unknown', name: 'Unknown' }
			},
			[`${SERVER_URL}/chain-assets/chart/hyperliquid`]: chart,
			[`${SERVER_URL}/chain-assets/chart/optimism`]: chart
		})
	}

	test('resolves a saved chain name to its producer metadata ID', async () => {
		serveChainAssets()
		await expect(fetchProChainChartData('bridgedTvl', 'Hyperliquid L1')).resolves.toEqual([[1_700_000_000, 42]])
		// Fixture routes also match by prefix, so a display-name slug like /hyperliquid-l1 would still be answered.
		expect(http.urls()).toContain(`${SERVER_URL}/chain-assets/chart/hyperliquid`)
	})

	test('rejects a failed chain assets fetch so callers do not cache a fake empty chart', async () => {
		serveChainAssets(fixtureStatus(404))
		await expect(fetchProChainChartData('bridgedTvl', 'Hyperliquid L1')).rejects.toThrow(/404/)
	})

	test('uses an already-resolved producer ID even when the saved name is not in metadata', async () => {
		serveChainAssets()
		await expect(fetchProChainChartData('bridgedTvl', 'Renamed Chain', undefined, 'optimism')).resolves.toEqual([
			[1_700_000_000, 42]
		])
	})

	test('does not fetch a chart for a chain without the chain-assets capability', async () => {
		serveChainAssets()
		await expect(fetchProChainChartData('bridgedTvl', 'Unknown')).resolves.toEqual([])
		expect(http.urls().filter((url) => url.includes('/chain-assets/'))).toEqual([])
	})
})

test.each([
	['optionsPremium', `${V2_SERVER_URL}/chart/options/chain/ethereum?dataType=dailyPremiumVolume`],
	['optionsNotional', `${V2_SERVER_URL}/chart/options/chain/ethereum?dataType=dailyNotionalVolume`],
	['openInterest', `${V2_SERVER_URL}/chart/open-interest/chain/ethereum?dataType=openInterestAtEnd`],
	['gasUsed', `${V2_SERVER_URL}/chart/active-users/chain/ethereum?dataType=dailyGasUsedUsd`],
	// Chain activity totals are chain pseudo-protocols, not chain-filtered app aggregates.
	['activeUsers', `${V2_SERVER_URL}/chart/active-users/protocol/ethereum`],
	['newUsers', `${V2_SERVER_URL}/chart/new-users/protocol/ethereum`],
	['txs', `${V2_SERVER_URL}/chart/active-users/protocol/ethereum?dataType=dailyTransactionsCount`]
])('reads the %s chart from its dedicated adapter series', async (chartType, url) => {
	http.serve({ [url]: [[1_700_000_000, 7]] })

	await expect(fetchProChainChartData(chartType, 'Ethereum')).resolves.toEqual([[1_700_000_000, 7]])
	expect(http.urls()).toEqual([url])
})

test('concurrent supply and inflow charts share one stablecoin response', async () => {
	http.serve({
		[`${STABLECOINS_SERVER_URL}/stablecoincharts2/Ethereum`]: {
			aggregated: [
				{ date: '1', totalCirculatingUSD: { peggedUSD: 10, peggedEUR: 5 } },
				{ date: '2', totalCirculatingUSD: { peggedUSD: 15, peggedEUR: 10 } }
			],
			breakdown: {
				double: [
					{ date: '1', totalCirculatingUSD: { peggedUSD: 2, peggedEUR: 1 } },
					{ date: '2', totalCirculatingUSD: { peggedUSD: 4, peggedEUR: 1 } }
				]
			},
			doublecountedIds: ['double']
		}
	})

	await expect(
		Promise.all([
			fetchProChainChartData('stablecoins', 'Ethereum'),
			fetchProChainChartData('stablecoinInflows', 'Ethereum')
		])
	).resolves.toEqual([
		[
			[1, 12],
			[2, 20]
		],
		[[2, 8]]
	])
	expect(http.requests).toHaveLength(1)
})
