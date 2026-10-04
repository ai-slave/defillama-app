import { describe, expect, test, vi } from 'vitest'
import { getChartDataPrerequisite, getProtocolCatalogPrerequisite, toChartRuntimeState } from '../chartRuntime'

describe('classic chart runtime state', () => {
	test('waits for streamed data before reporting a load failure', () => {
		const refetch = vi.fn()
		expect(
			toChartRuntimeState(
				{ data: undefined, isLoading: false, isFetching: false, errorUpdatedAt: 0, dataUpdatedAt: 0, refetch },
				false,
				{ status: 'ready' }
			)
		).toEqual({
			data: [],
			isLoading: true,
			hasError: false,
			canRetry: false,
			isFetching: false,
			refetch
		})
	})

	test('keeps stale chart data visible after a background refetch fails', () => {
		const refetch = vi.fn()
		const data: Array<[number, number]> = [[1_700_000_000, 42]]
		expect(
			toChartRuntimeState(
				{ data, isLoading: false, isFetching: false, errorUpdatedAt: 2000, dataUpdatedAt: 1000, refetch },
				true,
				{ status: 'ready' }
			)
		).toEqual({
			data,
			isLoading: false,
			hasError: false,
			canRetry: false,
			isFetching: false,
			refetch
		})
	})

	test('waits for the protocol catalog and retries its failure before starting a chart source', () => {
		const refetch = vi.fn()
		const retryCatalog = vi.fn()
		const query = { data: undefined, isLoading: false, isFetching: false, errorUpdatedAt: 0, dataUpdatedAt: 0, refetch }

		expect(toChartRuntimeState(query, true, { status: 'loading' })).toMatchObject({
			isLoading: true,
			hasError: false
		})
		expect(toChartRuntimeState(query, true, { status: 'error', retry: retryCatalog, retrying: false })).toEqual({
			data: [],
			isLoading: false,
			hasError: true,
			canRetry: true,
			isFetching: false,
			refetch: retryCatalog
		})
	})

	test('a protocol catalog that failed keeps its error on every protocol card while Try again reads it', () => {
		const refetchCatalog = vi.fn()
		const chartQuery = {
			data: undefined,
			isLoading: false,
			isFetching: false,
			errorUpdatedAt: 0,
			dataUpdatedAt: 0,
			refetch: vi.fn()
		}
		// A retry from a failure with no data: the query is pending again, so isError is false while it runs.
		const catalog = getProtocolCatalogPrerequisite(true, {
			data: undefined,
			errorUpdatedAt: 2000,
			dataUpdatedAt: 0,
			isFetching: true,
			refetch: refetchCatalog
		})

		const card = toChartRuntimeState(chartQuery, true, catalog)
		expect(card).toMatchObject({ data: [], isLoading: false, hasError: true, canRetry: true, isFetching: true })
		card.refetch()
		expect(refetchCatalog).toHaveBeenCalledOnce()
		expect(chartQuery.refetch).not.toHaveBeenCalled()
		expect(
			getProtocolCatalogPrerequisite(true, {
				data: { protocols: [], chains: [] },
				errorUpdatedAt: 2000,
				dataUpdatedAt: 3000,
				isFetching: false,
				refetch: refetchCatalog
			})
		).toEqual({ status: 'ready' })
	})

	test('keeps protocols outside canonical v2 membership unavailable without retrying their source', () => {
		const chart = {
			id: 'legacy',
			kind: 'chart',
			subjectType: 'protocol',
			protocol: 'legacy-protocol',
			type: 'fees'
		} as const
		const prerequisite = getChartDataPrerequisite(chart, { status: 'ready' }, new Set(['aave']))
		const refetch = vi.fn()

		expect(prerequisite).toEqual({ status: 'unavailable' })
		expect(
			toChartRuntimeState(
				{ data: undefined, isLoading: false, isFetching: false, errorUpdatedAt: 0, dataUpdatedAt: 0, refetch },
				true,
				prerequisite
			)
		).toEqual({
			data: [],
			isLoading: false,
			hasError: false,
			canRetry: false,
			isFetching: false,
			refetch
		})
	})
})
