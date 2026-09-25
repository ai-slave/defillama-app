import { describe, expect, test, vi } from 'vitest'
import { SERVER_URL, V2_SERVER_URL } from '~/constants'
import {
	adapterMetricBreakdown,
	adapterMetricByChainBreakdown
} from '~/containers/ProDashboard/server/chartBuilder/adapterMetrics/routes'
import { resolveAllowedChainNamesFromCategories } from '~/containers/ProDashboard/server/chartBuilder/breakdownChains'
import { chainNativeByChainBreakdown } from '~/containers/ProDashboard/server/chartBuilder/chains'
import { protocolTvlByChainBreakdown } from '~/containers/ProDashboard/server/chartBuilder/protocols'
import { stablecoinByChainBreakdown } from '~/containers/ProDashboard/server/chartBuilder/stablecoins'
import { getProtocolChainBreakdownRoute } from '~/containers/ProDashboard/utils/breakdownMetrics'
import { resultBody } from '~/server/api/__tests__/resultBody'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'

// The TVL route module opens a database pool at import; these tests never reach it.
vi.mock('~/server/db/llama', () => ({ llamaDb: {} }))

const http = installFixtureFetch()

function serveChainFees(protocols: Array<{ name: string; slug: string; protocolType: string; total24h: number }>) {
	http.serve({ [`${V2_SERVER_URL}/metrics/fees`]: { protocols, allChains: [] } })
}

describe('breakdown route partitioning', () => {
	test('rejects oversized chart-builder fan-out before fetching upstream data', async () => {
		const chains = Array.from({ length: 51 }, (_, index) => `Chain ${index}`).join(',')

		await expect(
			adapterMetricBreakdown.handle({
				method: 'GET',
				url: '',
				headers: {},
				query: { metric: 'fees', chains }
			})
		).resolves.toEqual({
			status: 400,
			body: { error: 'chains supports at most 50 values' }
		})
		expect(http.requests).toHaveLength(0)
	})

	test('rejects category resolution when any requested category is incomplete', async () => {
		http.serve({
			[`${SERVER_URL}/chains2/EVM`]: { chainsUnique: ['Ethereum'] },
			[`${SERVER_URL}/chains2/Rollups`]: fixtureStatus(404)
		})

		await expect(resolveAllowedChainNamesFromCategories(['EVM', 'Rollups'])).rejects.toThrow(/404/)
	})

	test('routes by-chain metrics to the registered route of their owning domain', () => {
		const withMetric = (route: string, metric: string) => route.replace('[metric]', metric)
		expect(getProtocolChainBreakdownRoute('tvl')).toBe(protocolTvlByChainBreakdown.route)
		expect(getProtocolChainBreakdownRoute('stablecoins')).toBe(stablecoinByChainBreakdown.route)
		for (const metric of ['chain-fees', 'chain-revenue']) {
			expect(getProtocolChainBreakdownRoute(metric)).toBe(withMetric(chainNativeByChainBreakdown.route, metric))
		}
		for (const metric of ['fees', 'dex-aggregators']) {
			expect(getProtocolChainBreakdownRoute(metric)).toBe(withMetric(adapterMetricByChainBreakdown.route, metric))
		}
	})

	test('rejects concrete protocols for chain-native by-chain breakdowns', async () => {
		await expect(
			chainNativeByChainBreakdown.handle({
				method: 'GET',
				url: '',
				headers: {},
				query: { metric: 'chain-fees', protocol: 'aave' }
			})
		).resolves.toEqual({
			status: 400,
			body: { error: 'chain-fees metric is only available when protocol=All' }
		})
	})

	test('rejects concrete protocols for stablecoin by-chain breakdowns', async () => {
		await expect(
			stablecoinByChainBreakdown.handle({
				method: 'GET',
				url: '',
				headers: {},
				query: { protocol: 'aave' }
			})
		).resolves.toEqual({
			status: 400,
			body: { error: 'stablecoins metric is only available when protocol=All' }
		})
	})

	test('filters chain-native breakdown categories against overview row slugs, not Dimensions aliases', async () => {
		http.serve({
			[`${SERVER_URL}/chains2/EVM`]: { chainsUnique: ['OP Mainnet'] },
			[`${V2_SERVER_URL}/chart/fees/protocol/op-mainnet`]: [
				[1, 10],
				[2, 30]
			]
		})
		serveChainFees([
			{ name: 'OP Mainnet', slug: 'op-mainnet', protocolType: 'chain', total24h: 30 },
			{ name: 'Gnosis', slug: 'gnosis', protocolType: 'chain', total24h: 20 },
			{ name: 'Aave', slug: 'aave', protocolType: 'protocol', total24h: 100 }
		])

		const result = await chainNativeByChainBreakdown.handle({
			method: 'GET',
			url: '',
			headers: {},
			query: { metric: 'chain-fees', chainCategories: 'EVM', limit: '5' }
		})

		expect(result.status).toBe(200)
		expect(resultBody(result)).toMatchObject({
			metadata: expect.objectContaining({
				chains: ['OP Mainnet'],
				totalChains: 1
			})
		})
	})

	test('normalizes saved legacy chain aliases for chain-native breakdown filters', async () => {
		serveChainFees([
			{ name: 'OP Mainnet', slug: 'op-mainnet', protocolType: 'chain', total24h: 30 },
			{ name: 'Gnosis', slug: 'gnosis', protocolType: 'chain', total24h: 20 },
			{ name: 'BSC', slug: 'bsc', protocolType: 'chain', total24h: 10 }
		])
		http.serve({
			[`${V2_SERVER_URL}/chart/fees/protocol/op-mainnet`]: [
				[1, 10],
				[2, 30]
			],
			[`${V2_SERVER_URL}/chart/fees/protocol/gnosis`]: [
				[1, 5],
				[2, 20]
			]
		})

		const result = await chainNativeByChainBreakdown.handle({
			method: 'GET',
			url: '',
			headers: {},
			query: { metric: 'chain-fees', chains: 'optimism,xdai', limit: '5' }
		})

		expect(result.status).toBe(200)
		expect(resultBody(result)).toMatchObject({
			metadata: expect.objectContaining({
				chains: ['OP Mainnet', 'Gnosis'],
				totalChains: 2
			})
		})
	})

	test('matches chain-native category filters by overview row names when slugs differ', async () => {
		http.serve({
			[`${SERVER_URL}/chains2/Custom`]: { chainsUnique: ['Abbrev Chain'] },
			[`${V2_SERVER_URL}/chart/fees/protocol/ac`]: [
				[1, 20],
				[2, 40]
			]
		})
		serveChainFees([
			{ name: 'Abbrev Chain', slug: 'ac', protocolType: 'chain', total24h: 40 },
			{ name: 'Other Chain', slug: 'other-chain', protocolType: 'chain', total24h: 30 }
		])

		const result = await chainNativeByChainBreakdown.handle({
			method: 'GET',
			url: '',
			headers: {},
			query: { metric: 'chain-fees', chainCategories: 'Custom', limit: '5' }
		})

		expect(result.status).toBe(200)
		expect(resultBody(result)).toMatchObject({
			metadata: expect.objectContaining({
				chains: ['Abbrev Chain'],
				totalChains: 1
			})
		})
	})
})
