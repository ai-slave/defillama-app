import { describe, expect, test } from 'vitest'
import { V2_SERVER_URL } from '~/constants'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { fetchProProtocolChartData } from '../ProtocolCharts'

const http = installFixtureFetch()
describe('Pro protocol chart sources', () => {
	test.each([
		['activeUsers', 'active-users', undefined, 11],
		['newUsers', 'new-users', undefined, 22],
		['txs', 'active-users', 'dailyTransactionsCount', 33],
		['gasUsed', 'active-users', 'dailyGasUsedUsd', 44]
	] as const)('fetches the selected %s activity data', async (type, adapter, dataType, value) => {
		const url = new URL(`${V2_SERVER_URL}/chart/${adapter}/protocol/compound-v2`)
		if (dataType) url.searchParams.set('dataType', dataType)
		http.serve({ [url.href]: [[1_700_000_000, value]] })
		await expect(fetchProProtocolChartData(type, 'compound-v2')).resolves.toEqual([[1_700_000_000, value]])
		expect(http.urls()).toEqual([url.href])
	})

	test('returns V2 TVL timestamps in Pro seconds after canonical normalization', async () => {
		http.serve({
			[`${V2_SERVER_URL}/chart/tvl/protocol/aave`]: [
				[1_700_000_000, 10],
				[1_700_086_400, 20]
			]
		})
		await expect(fetchProProtocolChartData('tvl', 'aave')).resolves.toEqual([
			[1_700_000_000, 10],
			[1_700_086_400, 20]
		])
	})

	test('fetches the borrowed series independently of total TVL', async () => {
		http.serve({
			[`${V2_SERVER_URL}/chart/tvl/protocol/aave?key=borrowed`]: [[1_700_000_000, 30]],
			[`${V2_SERVER_URL}/chart/tvl/protocol/aave`]: [[1_700_000_000, 100]]
		})
		await expect(fetchProProtocolChartData('borrowed', 'aave')).resolves.toEqual([[1_700_000_000, 30]])
	})
})
