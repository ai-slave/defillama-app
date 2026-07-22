import { describe, expect, it } from 'vitest'
import { sanitizeRowHeaders } from './components/UnifiedTable/utils/rowHeaders'
import type { UnifiedTableConfig } from './types'
import { getUnifiedTableQueryIdentity } from './unifiedTableQuery'

const createConfig = (chains: string[], category?: string): UnifiedTableConfig => ({
	id: 'table',
	kind: 'unified-table',
	rowHeaders: ['protocol'],
	params: { chains, category }
})

describe('getUnifiedTableQueryIdentity', () => {
	it('uses one identity for equivalent all-chain configurations', () => {
		const empty = getUnifiedTableQueryIdentity(createConfig([]), ['protocol'])
		const all = getUnifiedTableQueryIdentity(createConfig(['All']), ['protocol'])

		expect(all).toEqual(empty)
	})

	it('deduplicates, normalizes and sorts chain aliases', () => {
		const first = getUnifiedTableQueryIdentity(createConfig(['Optimism', 'Ethereum', 'OP Mainnet']), ['protocol'])
		const second = getUnifiedTableQueryIdentity(createConfig(['ethereum', 'op-mainnet']), ['protocol'])

		expect(first).toEqual(second)
	})

	it('keeps category and row-header selections in the identity', () => {
		const lending = getUnifiedTableQueryIdentity(createConfig([], 'Lending'), ['protocol'])
		const dex = getUnifiedTableQueryIdentity(createConfig([], 'Dexes'), ['protocol'])
		const grouped = getUnifiedTableQueryIdentity(createConfig([], 'Lending'), ['category', 'protocol'])

		expect(lending.queryKey).not.toEqual(dex.queryKey)
		expect(lending.queryKey).not.toEqual(grouped.queryKey)
	})

	it('uses one query identity for equivalent canonical persisted headers', () => {
		const config = createConfig(['All'])
		const duplicatePersisted = sanitizeRowHeaders(['protocol', 'parent-protocol', 'protocol'])
		const canonical = sanitizeRowHeaders(['parent-protocol', 'protocol'])

		expect(getUnifiedTableQueryIdentity(config, duplicatePersisted)).toEqual(
			getUnifiedTableQueryIdentity(config, canonical)
		)
	})
})
