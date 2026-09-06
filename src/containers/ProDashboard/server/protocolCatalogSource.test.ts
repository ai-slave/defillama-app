import { beforeEach, describe, expect, test, vi } from 'vitest'

const llamaQuery = vi.hoisted(() => vi.fn())
vi.mock('~/server/db/llama', () => ({ llamaDb: { query: llamaQuery } }))

import { fetchProProtocolCatalogSourceRows } from './protocolCatalogSource'

describe('Pro protocol catalog Lens source', () => {
	beforeEach(() => llamaQuery.mockReset())

	test('reads membership, TVL, parent policy, and canonical token metadata from Lens', async () => {
		llamaQuery.mockResolvedValue([
			{
				slug: 'child',
				name: 'Child',
				protocol: 'parent',
				category: 'dexes',
				tvl_base: 0,
				symbol: 'TOKEN',
				token_nk: 'coingecko:token-id',
				has_misrepresented_tokens: false,
				exclude_tvl_from_parent: true
			}
		])

		await expect(fetchProProtocolCatalogSourceRows()).resolves.toEqual([
			{
				slug: 'child',
				name: 'Child',
				parentSlug: 'parent',
				category: 'dexes',
				tvl: 0,
				symbol: 'TOKEN',
				geckoId: 'token-id',
				hasMisrepresentedTokens: false,
				excludeTvlFromParent: true
			}
		])
		expect(llamaQuery.mock.calls[0]?.[0]).toContain('FROM lens.metrics_sub_protocol_current metrics')
		expect(llamaQuery.mock.calls[0]?.[0]).toContain('JOIN dim.protocol p ON p.slug = metrics.sub_protocol')
	})
})
