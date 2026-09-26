import { describe, expect, test } from 'vitest'
import { installYieldsFixtures, yieldsSnapshot } from '~/utils/testing/yieldsSnapshotFixture'
import { getEarnPageMeta } from '../earnMeta.server'
import { earnPage, pool } from './earnSnapshot'

installYieldsFixtures()

// The fixture meta puts Aave in Lending and lido in Dexs; `unknown` has no meta, so no category.
const POOLS = [
	pool('eth-aave', { protocol: 'Aave', chain: 'Ethereum' }),
	pool('base-aave', { protocol: 'Aave', chain: 'Base' }),
	pool('eth-lido', { protocol: 'lido', chain: 'Ethereum' }),
	pool('eth-unknown', { protocol: 'unknown', chain: 'Ethereum' })
]

async function ids(query: Record<string, string | Array<string>>) {
	const result = await earnPage({ earn: POOLS }, { ...query, pageSize: 'all' })
	return result.rows.map((row) => row.id).sort()
}

describe('getEarnPage picker selections', () => {
	test('keeps every pool, uncategorized ones included, without picker keys', async () => {
		expect(await ids({})).toEqual(['base-aave', 'eth-aave', 'eth-lido', 'eth-unknown'])
	})

	test('reads an exclude list as every other value', async () => {
		expect(await ids({ excludeChain: 'Base' })).toEqual(['eth-aave', 'eth-lido', 'eth-unknown'])
		expect(await ids({ excludeProtocol: ['Aave', 'lido'] })).toEqual(['eth-unknown'])
	})

	test('files pools without a category under Uncategorized', async () => {
		expect(await ids({ category: 'Uncategorized' })).toEqual(['eth-unknown'])
		expect(await ids({ excludeCategory: 'Uncategorized' })).toEqual(['base-aave', 'eth-aave', 'eth-lido'])
		expect(await ids({ excludeCategory: 'Dexs' })).toEqual(['base-aave', 'eth-aave', 'eth-unknown'])
	})
})

describe('getEarnPageMeta category options', () => {
	test('offers Uncategorized when some pools have no category', async () => {
		const meta = await getEarnPageMeta(yieldsSnapshot({ earn: POOLS }))
		expect(meta.categoryList).toEqual(['Lending', 'Dexs', 'Uncategorized'])
	})
})
