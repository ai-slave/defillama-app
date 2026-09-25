import { describe, expect, test } from 'vitest'
import { buildStablecoinChartSeriesUrl, buildStablecoinVolumeChartUrl } from '../queries.client'
import { parseLimit, parseSeriesSelectionIntent } from '../server/api'

/** The query a Next API route receives for `url`: repeated keys become arrays. */
function routeQuery(url: string | null) {
	if (!url) throw new Error('Expected a request URL')
	const { pathname, searchParams } = new URL(url, 'https://defillama.com')
	const query: Record<string, string | Array<string>> = {}
	for (const key of new Set(searchParams.keys())) {
		const values = searchParams.getAll(key)
		query[key] = values.length === 1 ? values[0] : values
	}
	return { pathname, query }
}

describe('buildStablecoinChartSeriesUrl', () => {
	test('sends the overview filters the route reads and leaves unset filters out', () => {
		const { pathname, query } = routeQuery(
			buildStablecoinChartSeriesUrl({
				scope: 'overview',
				chain: 'All',
				chart: 'tokenMcaps',
				seriesLimit: 10,
				filters: {
					attribute: ['STABLE', 'YIELDBEARING'],
					excludePegtype: 'PEGGEDEUR',
					backing: undefined,
					minMcap: '100'
				},
				enabled: false
			})
		)

		expect(pathname).toBe('/api/public/stablecoins/chart-series')
		expect(query).toEqual({
			scope: 'overview',
			chart: 'tokenMcaps',
			limit: '10',
			chain: 'All',
			attribute: ['STABLE', 'YIELDBEARING'],
			excludePegtype: 'PEGGEDEUR',
			minMcap: '100'
		})
		expect(parseLimit(query.limit)).toBe(10)
	})

	test('asks an asset chart for unreleased supply', () => {
		expect(
			routeQuery(
				buildStablecoinChartSeriesUrl({
					scope: 'asset',
					stablecoin: 'tether',
					chart: 'totalCirc',
					includeUnreleased: true
				})
			).query
		).toEqual({ scope: 'asset', chart: 'totalCirc', stablecoin: 'tether', unreleased: 'true' })
	})

	test.each([
		{ mode: 'include' as const, names: ['USDT', 'DAI'] },
		{ mode: 'include' as const, names: ['USDT'] },
		{ mode: 'exclude' as const, names: ['Ethereum'] }
	])('the route reads back the $mode selection of $names', (selectionIntent) => {
		const { query } = routeQuery(
			buildStablecoinChartSeriesUrl({ scope: 'chains', chart: 'chainMcaps', selectionIntent })
		)
		expect(parseSeriesSelectionIntent(query)).toEqual(selectionIntent)
	})
})

describe('buildStablecoinVolumeChartUrl', () => {
	test('asks for every volume series only for a complete export', () => {
		expect(
			routeQuery(buildStablecoinVolumeChartUrl({ scope: 'global', chart: 'token', allSeries: true })).query
		).toEqual({ scope: 'global', chart: 'token', all: 'true' })
		expect(
			parseLimit(routeQuery(buildStablecoinVolumeChartUrl({ scope: 'global', chart: 'chain', limit: 10 })).query.limit)
		).toBe(10)
	})

	test('the route reads back a volume exclusion', () => {
		const { query } = routeQuery(
			buildStablecoinVolumeChartUrl({
				scope: 'global',
				chart: 'token',
				selectionIntent: { mode: 'exclude', names: ['USDT'] }
			})
		)
		expect(parseSeriesSelectionIntent(query)).toEqual({ mode: 'exclude', names: ['USDT'] })
	})

	test('scopes volume requests to the chain or the token', () => {
		expect(
			routeQuery(buildStablecoinVolumeChartUrl({ scope: 'chain', chain: 'Ethereum', chart: 'token' })).query
		).toEqual({ scope: 'chain', chart: 'token', limit: '20', chain: 'Ethereum' })
		expect(routeQuery(buildStablecoinVolumeChartUrl({ scope: 'token', token: 'USDT', chart: 'chain' })).query).toEqual({
			scope: 'token',
			chart: 'chain',
			limit: '20',
			token: 'USDT'
		})
	})
})
