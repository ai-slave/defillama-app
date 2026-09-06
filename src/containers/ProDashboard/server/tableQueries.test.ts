import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { ProtocolTokenUsageData } from '~/containers/TokenUsage/api.types'
import type { TokenUsageDatasetTableConfig } from '../types'

const llamaQuery = vi.hoisted(() => vi.fn())
vi.mock('~/server/db/llama', () => ({ llamaDb: { query: llamaQuery } }))

import { fetchProTokenUsageData, streamProTokenUsageData } from './tableQueries'

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

	test('queries normalized token symbols once and deduplicates matching configs', async () => {
		const chunks: Array<{ key: string; data: Array<ProtocolTokenUsageData> }> = []
		await streamProTokenUsageData(
			[tokenUsageTable, { ...tokenUsageTable, id: 'duplicate', tokenSymbols: ['usdt', 'usdc'] }],
			() => true,
			(run) => run(),
			async (chunk) => {
				chunks.push(chunk)
			}
		)

		expect(llamaQuery).toHaveBeenCalledOnce()
		expect(llamaQuery).toHaveBeenCalledWith(expect.stringContaining("LIKE '%' || LOWER(requested.symbol) || '%'"), [
			['USDC', 'USDT'],
			false
		])
		expect(llamaQuery.mock.calls[0]?.[0]).toContain('AND t.tvl IS NOT NULL')
		expect(chunks).toHaveLength(1)
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

	test('does not create a legacy protocol source for Unified tables', async () => {
		await streamProTokenUsageData(
			[
				{
					id: 'unified',
					kind: 'unified-table',
					configVersion: 3,
					strategy: 'protocols',
					rowHeaders: ['protocol']
				}
			],
			() => true,
			(run) => run(),
			async () => {
				throw new Error('Unified tables must not produce token-usage data')
			}
		)

		expect(llamaQuery).not.toHaveBeenCalled()
	})
})
