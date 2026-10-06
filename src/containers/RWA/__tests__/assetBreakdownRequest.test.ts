import { expect, test } from 'vitest'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { fetchRwaAssetChartData } from '../hooks'
import { parseAssetBreakdownRequest } from '../server/api'

const http = installFixtureFetch()

test('the asset-breakdown route reads back the scope and flags the chart client sends', async () => {
	http.serve({ '/api/public/rwa/asset-breakdown': [] })

	await fetchRwaAssetChartData({
		key: 'defiActiveTvl',
		target: { kind: 'platform', slug: 'ondo-finance' },
		includeStablecoins: true,
		includeGovernance: true,
		includeBridgeTvl: false
	})

	const [{ url }] = http.requests
	expect(parseAssetBreakdownRequest({ query: Object.fromEntries(url.searchParams) })).toEqual({
		target: { kind: 'platform', slug: 'ondo-finance' },
		key: 'defiActiveTvl',
		includeStablecoin: true,
		includeGovernance: true,
		includeBridgeTvl: false
	})
})
