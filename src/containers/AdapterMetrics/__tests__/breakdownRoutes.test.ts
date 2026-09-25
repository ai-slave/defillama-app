import { beforeEach, describe, expect, test, vi } from 'vitest'
import { resultBody } from '~/server/api/__tests__/resultBody'

type Route = (path: string) => unknown

const upstream = vi.hoisted(() => ({
	route: (() => undefined) as (path: string) => unknown
}))

vi.mock('~/utils/async', async (importOriginal) => ({
	...(await importOriginal<typeof import('~/utils/async')>()),
	fetchJson: async (url: string) => {
		const path = new URL(url).pathname
		const body = upstream.route(path)
		if (body === undefined) throw new Error(`Unrouted upstream request: ${path}`)
		return body
	}
}))

const today = Math.floor(Date.now() / 86_400_000) * 86_400
const day = (daysAgo: number) => today - daysAgo * 86_400

// The routes cache protocol lookups and results at module level; a fresh module graph per test keeps them isolated.
async function loadRoutes(route: Route) {
	upstream.route = (path) =>
		route(path) ?? (path.endsWith('/lite/protocols2') ? { protocols: [], parentProtocols: [] } : undefined)
	return import('~/containers/ProDashboard/server/chartBuilder/adapterMetrics/routes')
}

function get(query: Record<string, string>) {
	return { method: 'GET', url: '', headers: {}, query }
}

const seriesNames = (body: { series: Array<{ name: string }> }) => body.series.map((series) => series.name)

beforeEach(() => {
	vi.resetModules()
})

describe('AdapterMetrics breakdown routes', () => {
	test('ranks protocols by their latest value within seven complete days', async () => {
		const { adapterMetricBreakdown } = await loadRoutes((path) =>
			path.endsWith('/chart/aggregators/protocol-breakdown')
				? [
						[day(9), { Filler: 1 }],
						[day(8), { Expired: 1000 }],
						[day(7), { Filler: 1 }],
						[day(6), { Filler: 1 }],
						[day(5), { Changing: 900, Filler: 1 }],
						[day(4), { Filler: 1 }],
						[day(3), { Recent: 600, Filler: 1 }],
						[day(2), { Changing: 400, Filler: 1 }],
						[day(1), { Fresh: 500, Competitor: 450, Filler: 1 }],
						[today, { Current: 2000 }]
					]
				: undefined
		)

		const result = await adapterMetricBreakdown.handle(get({ metric: 'dex-aggregators', limit: '3' }))

		expect(result.status).toBe(200)
		const body = resultBody(result)
		expect(seriesNames(body).slice(0, 3)).toEqual(['Recent', 'Fresh', 'Competitor'])
		expect(body.series.find((series: { name: string }) => series.name === 'Recent').data).toContainEqual([day(1), 0])
		expect(seriesNames(body)).not.toContain('Changing')
		expect(seriesNames(body)).not.toContain('Expired')
		expect(seriesNames(body)).not.toContain('Current')
		expect(body.metadata).toMatchObject({ entityType: 'protocol', topN: 3, totalProtocols: 5, othersCount: 2 })
	})

	test('labels and counts grouped protocol families without calling them protocols', async () => {
		const { adapterMetricBreakdown } = await loadRoutes((path) => {
			if (path.endsWith('/lite/protocols2'))
				return {
					protocols: [
						{ name: 'Child A', category: 'Dexs', parentProtocol: 'parent#family' },
						{ name: 'Child B', category: 'Dexs', parentProtocol: 'parent#family' },
						{ name: 'Standalone', category: 'Dexs' }
					],
					parentProtocols: [{ id: 'parent#family', name: 'Family' }]
				}
			if (path.endsWith('/chart/dexs/protocol-breakdown'))
				return [
					[day(2), { 'Child A': 40, 'Child B': 30, Standalone: 60 }],
					[day(1), { 'Child A': 60, 'Child B': 50, Standalone: 100 }]
				]
		})

		const body = resultBody(
			await adapterMetricBreakdown.handle(get({ metric: 'volume', limit: '1', groupByParent: 'true' }))
		)

		expect(seriesNames(body)).toEqual(['Family', 'Others (1 protocol family)'])
		expect(body.metadata).toMatchObject({ entityType: 'protocol-family', totalProtocolFamilies: 2, othersCount: 1 })
		expect(body.metadata).not.toHaveProperty('totalProtocols')
	})

	test.each([
		{ chains: 'BSC', label: 'display-name chain keys' },
		{ chains: 'bsc', label: 'saved legacy chain aliases' }
	])('filters protocol-specific chain summaries by $label', async ({ chains }) => {
		const { adapterMetricByChainBreakdown } = await loadRoutes((path) =>
			path.endsWith('/chart/fees/protocol/aave/chain-breakdown')
				? [
						[1, { BSC: 10, Ethereum: 50 }],
						[2, { BSC: 30, Ethereum: 60 }]
					]
				: undefined
		)

		const result = await adapterMetricByChainBreakdown.handle(
			get({ metric: 'fees', protocol: 'aave', chains, limit: '5' })
		)

		expect(result.status).toBe(200)
		expect(resultBody(result).metadata.chains).toEqual(['BSC'])
	})

	test('does not mutate the cached protocol category lookup with overview protocol aliases', async () => {
		let overviewCalls = 0
		const { adapterMetricByChainBreakdown } = await loadRoutes((path) => {
			if (path.endsWith('/metrics/fees')) {
				overviewCalls += 1
				return {
					protocols: [
						{
							name: 'Transient Protocol',
							displayName: 'Transient Protocol',
							slug: 'transient-protocol',
							category: overviewCalls === 1 ? 'Lending' : null,
							breakdown24h: { bsc: { v1: 10 } }
						}
					],
					allChains: ['BSC']
				}
			}
			if (path.includes('/chart/fees/')) return [[1, { 'Transient Protocol': 10 }]]
		})

		const first = await adapterMetricByChainBreakdown.handle(
			get({ metric: 'fees', protocol: 'All', protocolCategories: 'lending', limit: '1' })
		)
		const second = await adapterMetricByChainBreakdown.handle(
			get({ metric: 'revenue', protocol: 'All', protocolCategories: 'lending', limit: '2' })
		)

		expect(resultBody(first).metadata.totalChains).toBe(1)
		expect(resultBody(second).metadata.totalChains).toBe(0)
		expect(overviewCalls).toBe(2)
	})

	test.each(['include', 'exclude'] as const)(
		'rejects a partial selected-chain protocol aggregate in %s mode',
		async (chainFilterMode) => {
			const { adapterMetricBreakdown } = await loadRoutes((path) => {
				if (path.endsWith('/chain/base/protocol-breakdown')) throw new Error('Base unavailable')
				if (path.endsWith('/protocol-breakdown')) return []
			})

			const result = await adapterMetricBreakdown.handle(
				get({ metric: 'volume', chains: 'Base,Ethereum', chainFilterMode })
			)

			expect(result.status).toBe(500)
		}
	)

	test('rejects an all-protocol chain chart when a ranked chain request fails', async () => {
		const { adapterMetricByChainBreakdown } = await loadRoutes((path) => {
			if (path.endsWith('/metrics/derivatives'))
				return {
					protocols: [
						{
							name: 'Protocol',
							displayName: 'Protocol',
							slug: 'protocol',
							category: null,
							breakdown24h: { bsc: { v1: 10 } }
						}
					],
					allChains: ['BSC']
				}
			if (path.endsWith('/chart/derivatives/chain/bsc')) throw new Error('BSC unavailable')
			if (path.includes('/chart/derivatives')) return []
		})

		const result = await adapterMetricByChainBreakdown.handle(get({ metric: 'perps', protocol: 'All' }))

		expect(result.status).toBe(500)
	})
})
