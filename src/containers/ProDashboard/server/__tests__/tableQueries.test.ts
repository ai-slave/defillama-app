import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { ProtocolTokenUsageData } from '~/containers/TokenUsage/api.types'
import type { DashboardItemConfig } from '../../dashboardItemConfig'
import type { TokenUsageDatasetTableConfig } from '../../types'
import { createStreamItemReadiness, createStreamSourceRegistry } from '../stream/itemReadiness'

const llamaQuery = vi.hoisted(() => vi.fn())
vi.mock('~/server/db/llama', () => ({ llamaDb: { query: llamaQuery } }))

import { fetchProTokenUsageData, streamProTokenUsageData } from '../tableQueries'

function createSourceRegistry(items: Array<DashboardItemConfig>) {
	const readyItemIds: Array<string> = []
	const readiness = createStreamItemReadiness(items)
	const sources = createStreamSourceRegistry(
		readiness,
		(run) => run(),
		async (itemIds) => {
			readyItemIds.push(...itemIds)
		}
	)
	return { readiness, sources, readyItemIds }
}

const tokenUsageTable: TokenUsageDatasetTableConfig = {
	id: 'token-usage',
	kind: 'dataset-table',
	datasetType: 'token-usage',
	tokenSymbols: ['USDC', 'USDT'],
	includeCex: false
}

describe('token usage table server data', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		llamaQuery.mockResolvedValue([])
	})

	test('queries normalized token symbols once and reports every deduplicated config ready', async () => {
		const chunks: Array<{ key: string; data: Array<ProtocolTokenUsageData> }> = []
		const items: Array<DashboardItemConfig> = [
			tokenUsageTable,
			{ ...tokenUsageTable, id: 'duplicate', tokenSymbols: ['usdt', 'usdc'] }
		]
		const { sources, readyItemIds, readiness } = createSourceRegistry(items)
		await streamProTokenUsageData(items, sources, async (chunk) => {
			chunks.push(chunk)
		})

		expect(llamaQuery).toHaveBeenCalledOnce()
		expect(llamaQuery.mock.calls[0][1]).toEqual([['USDC', 'USDT'], false])
		expect(chunks).toHaveLength(1)
		expect(readyItemIds.sort()).toEqual(['duplicate', 'token-usage'])
		expect(readiness.pending()).toEqual([])
	})

	test('constructs canonical protocol totals from Lens token components', async () => {
		llamaQuery.mockResolvedValue([
			{
				protocol: 'sky-lending',
				name: 'Sky Lending',
				category: 'lending',
				symbol: 'USDC',
				amount_usd: 4000
			},
			{
				protocol: 'sky-lending',
				name: 'Sky Lending',
				category: 'lending',
				symbol: 'USDT',
				amount_usd: 500
			}
		])

		const rows = await fetchProTokenUsageData(tokenUsageTable.tokenSymbols, tokenUsageTable.includeCex)

		expect(rows).toEqual([
			{
				name: 'Sky Lending',
				category: 'Lending',
				amountUsd: 4500,
				logo: 'https://icons.llamao.fi/icons/protocols/sky-lending?w=48&h=48',
				tokens: { USDC: 4000, USDT: 500 }
			}
		])
	})
})
