import { describe, expect, it } from 'vitest'
import type { IChainMetadata } from '~/utils/metadata/types'
import { getAvailableChainChartTypes } from './appMetadataChartTypes'
import { buildProtocolMetadataIndex } from './AppMetadataContext'

describe('buildProtocolMetadataIndex', () => {
	it('merges duplicate protocol entries without losing true capabilities or chains', () => {
		const index = buildProtocolMetadataIndex({
			one: { name: 'aave', displayName: 'Aave', chains: ['Ethereum'], fees: false, revenue: true },
			two: { name: 'aave', chains: ['Base'], fees: true, revenue: false }
		})
		const record = index.get('aave')

		expect(record?.displayName).toBe('Aave')
		expect(record?.chains).toEqual(['Ethereum', 'Base'])
		expect(record?.builderMetrics.has('fees')).toBe(true)
		expect(record?.builderMetrics.has('revenue')).toBe(true)
	})

	it('does not claim chain-only metrics are protocol capabilities', () => {
		const record = buildProtocolMetadataIndex({ one: { name: 'aave', fees: true } }).get('aave')

		expect(record?.builderMetrics.has('chain-fees')).toBe(false)
		expect(record?.builderMetrics.has('chain-revenue')).toBe(false)
	})
})

describe('Pro dashboard chain chart availability', () => {
	it('exposes canonical adapter metrics when chain metadata advertises them', () => {
		const flags = { name: 'Avalanche', gasUsed: true, openInterest: true } as IChainMetadata

		expect(getAvailableChainChartTypes(flags)).toContain('gasUsed')
		expect(getAvailableChainChartTypes(flags)).toContain('openInterest')
	})
})
