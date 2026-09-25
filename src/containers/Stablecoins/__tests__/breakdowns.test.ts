import { beforeEach, describe, expect, test, vi } from 'vitest'
import { SERVER_URL, STABLECOINS_SERVER_URL } from '~/constants'
import type { StablecoinChartPoint } from '~/containers/Stablecoins/api.types'
import { resultBody } from '~/server/api/__tests__/resultBody'
import { installFixtureFetch } from '~/utils/test/fixtureFetch'

const http = installFixtureFetch()
const AGGREGATE_URL = `${STABLECOINS_SERVER_URL}/stablecoincharts2/all`
const DOMINANCE_URL = `${STABLECOINS_SERVER_URL}/stablecoincharts2/all-dominance-chain-breakdown`
const EVM_CHAINS_URL = `${SERVER_URL}/chains2/EVM`

// The breakdown caches its base data per module instance.
beforeEach(() => {
	vi.resetModules()
})

const point = (date: number, value: number): StablecoinChartPoint => ({
	date: String(date),
	totalCirculatingUSD: { peggedUSD: value }
})

function mockAggregate(value = 1000) {
	http.serve({
		[AGGREGATE_URL]: { aggregated: [point(86_400, value), point(172_800, value)], breakdown: {}, doublecountedIds: [] }
	})
}

function mockDominance(values: Record<string, number>) {
	http.serve({
		[DOMINANCE_URL]: {
			chainChartMap: Object.fromEntries(
				Object.entries(values).map(([chain, value]) => [chain, [point(86_400, value / 2), point(172_800, value)]])
			)
		}
	})
}

async function fetchBreakdown(query: Record<string, string>) {
	const { stablecoinByChainBreakdown } = await import('~/containers/ProDashboard/server/chartBuilder/stablecoins')
	const result = await stablecoinByChainBreakdown.handle({
		method: 'GET',
		url: '',
		headers: {},
		query
	})

	expect(result.status).toBe(200)
	return resultBody(result)
}

describe('stablecoin breakdown routes', () => {
	test('filters stablecoin dominance chains by exact display names', async () => {
		mockAggregate()
		mockDominance({
			Gnosis: 40,
			'OP Mainnet': 30,
			Ethereum: 20
		})

		const body = await fetchBreakdown({
			limit: '5',
			chains: 'Gnosis,OP Mainnet'
		})

		expect(body).toMatchObject({
			metadata: expect.objectContaining({
				chains: ['Gnosis', 'OP Mainnet'],
				totalChains: 2
			})
		})
	})

	test('keeps stablecoin chain-id aliases working for saved chart-builder configs', async () => {
		mockAggregate()
		mockDominance({
			Gnosis: 40,
			'OP Mainnet': 30,
			'ZKsync Era': 20
		})

		const body = await fetchBreakdown({
			limit: '5',
			chains: 'xdai,optimism,era'
		})

		expect(body).toMatchObject({
			metadata: expect.objectContaining({
				chains: ['Gnosis', 'OP Mainnet', 'ZKsync Era'],
				totalChains: 3
			})
		})
	})

	test('excludes stablecoin dominance chains by exact display name', async () => {
		mockAggregate()
		mockDominance({
			Gnosis: 40,
			'OP Mainnet': 30,
			Ethereum: 20
		})

		const body = await fetchBreakdown({
			limit: '5',
			chains: 'Gnosis',
			chainFilterMode: 'exclude'
		})

		expect(body).toMatchObject({
			metadata: expect.objectContaining({
				chains: ['OP Mainnet', 'Ethereum'],
				totalChains: 2
			})
		})
	})

	test('applies stablecoin dominance category filters with display names', async () => {
		mockAggregate()
		mockDominance({
			Gnosis: 40,
			'OP Mainnet': 30,
			Ethereum: 20
		})
		http.serve({ [EVM_CHAINS_URL]: { chainsUnique: ['Gnosis', 'Ethereum'] } })

		const body = await fetchBreakdown({
			limit: '5',
			chainCategories: 'EVM'
		})

		expect(body).toMatchObject({
			metadata: expect.objectContaining({
				chains: ['Gnosis', 'Ethereum'],
				totalChains: 2
			})
		})
	})

	test('calculates filtered Others from the filtered chains only', async () => {
		mockAggregate()
		mockDominance({
			Gnosis: 40,
			'OP Mainnet': 30,
			Ethereum: 20
		})
		http.serve({ [EVM_CHAINS_URL]: { chainsUnique: ['Gnosis', 'Ethereum'] } })

		const body = await fetchBreakdown({
			limit: '1',
			chainCategories: 'EVM'
		})

		expect(body).toMatchObject({
			series: [
				{
					name: 'Gnosis',
					data: [
						[86_400, 20],
						[172_800, 40]
					]
				},
				{
					name: 'Others (1 chains)',
					data: [
						[86_400, 10],
						[172_800, 20]
					]
				}
			]
		})
	})

	test('keeps the last stablecoin supply snapshot when multiple points share a UTC day', async () => {
		http.serve({
			[AGGREGATE_URL]: { aggregated: [point(86_401, 70), point(86_402, 90)], breakdown: {}, doublecountedIds: [] },
			[DOMINANCE_URL]: {
				chainChartMap: {
					Ethereum: [point(86_401, 40), point(86_402, 50)],
					Base: [point(86_401, 30), point(86_402, 40)]
				}
			}
		})

		const body = await fetchBreakdown({ limit: '1' })

		expect(body).toMatchObject({
			series: [
				{ name: 'Ethereum', data: [[86_400, 50]] },
				{ name: 'Others (1 chains)', data: [[86_400, 40]] }
			]
		})
	})
})
