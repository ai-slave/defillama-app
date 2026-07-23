import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type QueryOptions = {
	queryKey: readonly unknown[]
	queryFn: () => unknown
	enabled?: boolean
}

const mocks = vi.hoisted(() => ({
	queryOptions: [] as QueryOptions[],
	queryGroups: [] as QueryOptions[][]
}))

vi.mock('@tanstack/react-query', () => ({
	useQuery: (options: QueryOptions) => {
		mocks.queryOptions.push(options)
		return { data: undefined, dataUpdatedAt: 0, error: null, isLoading: false }
	},
	useQueries: ({ queries }: { queries: QueryOptions[] }) => {
		mocks.queryGroups.push(queries)
		return queries.map(() => ({ data: undefined, dataUpdatedAt: 0, error: null, isLoading: false }))
	}
}))

vi.mock('../../queries', async () => {
	const { createContext } = await import('react')
	return { StreamDoneContext: createContext(true) }
})

import {
	useGetProtocolsEarningsByMultiChain,
	useGetProtocolsFeesAndRevenueByMultiChain,
	useGetProtocolsListMultiChain,
	useGetProtocolsVolumeByMultiChain
} from './useProTableMultiChain'

function QueryProbe({ enableMetrics }: { enableMetrics: boolean }) {
	useGetProtocolsListMultiChain(['Base'], true)
	useGetProtocolsVolumeByMultiChain(['Base'], enableMetrics)
	useGetProtocolsFeesAndRevenueByMultiChain(['Base'], enableMetrics)
	useGetProtocolsEarningsByMultiChain(['Base'], enableMetrics)
	return null
}

describe('Pro table source query enabling', () => {
	beforeEach(() => {
		mocks.queryOptions.length = 0
		mocks.queryGroups.length = 0
	})

	it('keeps hooks unconditional while disabling unplanned metric queries', () => {
		renderToStaticMarkup(<QueryProbe enableMetrics={false} />)

		expect(mocks.queryOptions.map((query) => [query.queryKey, query.enabled])).toEqual([
			[['protocols-lite'], true],
			[['pro-dashboard', 'protocols-earnings-multi-chain', 'Base'], false]
		])
		expect(mocks.queryGroups.flat().map((query) => [query.queryKey, query.enabled])).toEqual([
			[['pro-dashboard', 'protocols-volume-by-chain', 'Base'], false],
			[['pro-dashboard', 'protocols-fees-revenue-by-chain', 'Base'], false]
		])
	})

	it('enables the same preserved query identities when a column is added lazily', () => {
		renderToStaticMarkup(<QueryProbe enableMetrics />)

		expect(mocks.queryOptions.every((query) => query.enabled)).toBe(true)
		expect(mocks.queryGroups.flat().every((query) => query.enabled)).toBe(true)
	})
})
