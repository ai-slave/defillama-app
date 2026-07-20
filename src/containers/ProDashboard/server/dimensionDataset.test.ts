import { describe, expect, it } from 'vitest'
import type { DimensionDatasetSpec } from '~/containers/AdapterMetrics/server/datasets'
import { filterProDimensionDatasetChains } from './dimensionDataset'

const optionsSpec = {
	datasetType: 'options',
	options: { adapterType: 'options', route: 'options', metricName: 'Options Volume' }
} as DimensionDatasetSpec

describe('Pro dimension dataset planning', () => {
	it('removes unsupported chains from persisted options tables', () => {
		expect(
			filterProDimensionDatasetChains(optionsSpec, ['Ethereum', 'Solana'], {
				ethereum: { id: 'ethereum', name: 'Ethereum', optionsPremiumVolume: true },
				solana: { id: 'solana', name: 'Solana' }
			})
		).toEqual(['Ethereum'])
	})

	it('preserves All because the canonical dataset fetcher handles aggregate scope', () => {
		expect(filterProDimensionDatasetChains(optionsSpec, ['All'], {})).toEqual(['All'])
	})
})
