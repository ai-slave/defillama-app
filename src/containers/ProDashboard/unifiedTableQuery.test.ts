import { describe, expect, test } from 'vitest'
import type { UnifiedTableConfig } from './unifiedTable/config/current'
import { getUnifiedTableQueryIdentity } from './unifiedTableQuery'

const createConfig = (chains: Array<string>, category?: string): UnifiedTableConfig => ({
	id: 'table',
	kind: 'unified-table',
	configVersion: 3,
	strategy: 'protocols',
	rowHeaders: ['protocol'],
	params: { chains, ...(category ? { category } : {}) }
})

describe('getUnifiedTableQueryIdentity', () => {
	test('treats an All chain selection as the aggregate all-chain source', () => {
		const all = getUnifiedTableQueryIdentity(createConfig(['All']), ['protocol'])

		expect(all.paramsKey).toBe('{"chains":[],"category":null}')
		expect(all.sourceGranularity).toBe('aggregate')
	})

	test('deduplicates, normalizes and sorts chain aliases', () => {
		const identity = getUnifiedTableQueryIdentity(createConfig(['Optimism', 'Ethereum', 'OP Mainnet']), ['protocol'])

		expect(identity.paramsKey).toBe('{"chains":["ethereum","op-mainnet"],"category":null}')
		expect(identity.sourceGranularity).toBe('chain')
	})

	test('keys source identity by category and aggregate-versus-chain granularity', () => {
		const lending = getUnifiedTableQueryIdentity(createConfig([], 'Lending'), ['protocol'])
		const dex = getUnifiedTableQueryIdentity(createConfig([], 'Dexes'), ['protocol'])
		const grouped = getUnifiedTableQueryIdentity(createConfig([], 'Lending'), ['category', 'protocol'])
		const byChain = getUnifiedTableQueryIdentity(createConfig([], 'Lending'), ['category', 'chain', 'protocol'])

		expect(lending.queryKey).not.toEqual(dex.queryKey)
		expect(lending.queryKey).toEqual(grouped.queryKey)
		expect(lending.queryKey).not.toEqual(byChain.queryKey)
	})

	test('changes identity only when a requested point-comparison source changes', () => {
		const hidden = createConfig([])
		hidden.columnOrder = ['fees24hChange7dAgo']
		hidden.columnVisibility = { fees24hChange7dAgo: false }
		const visible = { ...hidden, columnVisibility: { fees24hChange7dAgo: true } }
		const sameSource = { ...visible, columnOrder: ['fees24hChange30dAgo'] }

		expect(getUnifiedTableQueryIdentity(hidden, ['protocol']).pointMetrics).toEqual([])
		expect(getUnifiedTableQueryIdentity(visible, ['protocol']).pointMetrics).toEqual(['fees'])
		expect(getUnifiedTableQueryIdentity(visible, ['protocol']).baseMetricFamilies).toEqual(['fees'])
		expect(getUnifiedTableQueryIdentity(visible, ['protocol']).queryKey).toEqual(
			getUnifiedTableQueryIdentity(sameSource, ['protocol']).queryKey
		)
		expect(getUnifiedTableQueryIdentity(hidden, ['protocol']).queryKey).not.toEqual(
			getUnifiedTableQueryIdentity(visible, ['protocol']).queryKey
		)
	})

	test('requests point comparisons used only by hidden filters', () => {
		const config = createConfig([])
		config.columnVisibility = { fees24hChange7dAgo: false }
		config.filters = { fees24hChange7dAgoMin: -20 }

		expect(getUnifiedTableQueryIdentity(config, ['protocol']).pointMetrics).toEqual(['fees'])
		expect(getUnifiedTableQueryIdentity(config, ['protocol']).baseMetricFamilies).toEqual(['fees'])
	})

	test('includes only requested base metric families in the identity', () => {
		const hidden = createConfig([])
		hidden.columnOrder = ['openInterest']
		hidden.columnVisibility = { openInterest: false }
		const visible = { ...hidden, columnVisibility: { openInterest: true } }

		expect(getUnifiedTableQueryIdentity(hidden, ['protocol']).baseMetricFamilies).toEqual([])
		expect(getUnifiedTableQueryIdentity(visible, ['protocol']).baseMetricFamilies).toEqual(['open-interest'])
		expect(getUnifiedTableQueryIdentity(hidden, ['protocol']).queryKey).not.toEqual(
			getUnifiedTableQueryIdentity(visible, ['protocol']).queryKey
		)
	})

	test('derives ratio dependencies from the requested metric families rather than response rows', () => {
		const config = createConfig([])
		config.columnOrder = ['mcaptvl', 'pf']
		config.columnVisibility = { mcaptvl: true, pf: true }

		expect(getUnifiedTableQueryIdentity(config, ['protocol']).requestedRatioDependencies).toEqual({
			marketCap: true,
			tvl: true,
			fees: true,
			revenue: false
		})
	})

	test('separates metric-preset membership from a broad custom table with the same columns', () => {
		const custom = createConfig([])
		custom.columnOrder = ['fees24h']
		custom.columnVisibility = { fees24h: true }
		const feesPreset = { ...custom, activePresetId: 'fees-protocols' }

		expect(getUnifiedTableQueryIdentity(custom, ['protocol']).rowMembershipKey).toBe('all-protocols')
		expect(getUnifiedTableQueryIdentity(feesPreset, ['protocol']).rowMembershipKey).toBe('base:fees')
		expect(getUnifiedTableQueryIdentity(custom, ['protocol']).queryKey).not.toEqual(
			getUnifiedTableQueryIdentity(feesPreset, ['protocol']).queryKey
		)
	})
})
