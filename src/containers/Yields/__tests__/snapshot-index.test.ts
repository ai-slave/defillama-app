import { describe, expect, it } from 'vitest'
import type { IYieldTableRow } from '~/containers/Yields/Tables/types'
import { buildYieldsTokenIndexes } from '../server/snapshot.index'

const row = {
	pool: 'WBTC-ETH',
	configID: 'pool-1',
	chains: ['Ethereum'],
	tvl: 1,
	apy: 1
} as IYieldTableRow

describe('Yields snapshot token indexes', () => {
	it('stores stable row IDs rather than duplicated row payloads', () => {
		const indexes = buildYieldsTokenIndexes([row, row])
		expect(indexes.get('btc')).toEqual(['pool-1'])
		expect(indexes.get('eth')).toEqual(['pool-1'])
		expect(indexes.get('wbtc')).toEqual(['pool-1'])
	})
})
