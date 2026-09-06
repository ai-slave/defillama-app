import { describe, expect, test, vi } from 'vitest'
import { getChartDataPrerequisite, toChartRuntimeState } from './chartRuntime'

describe('classic chart runtime state', () => {
	test('waits for streamed data before reporting a load failure', () => {
		const refetch = vi.fn()
		expect(
			toChartRuntimeState({ data: undefined, isLoading: false, isError: false, refetch }, false, { status: 'ready' })
		).toEqual({
			data: [],
			isLoading: true,
			hasError: false,
			canRetry: false,
			refetch
		})
	})

	test('keeps stale chart data visible after a background refetch fails', () => {
		const refetch = vi.fn()
		const data: Array<[number, number]> = [[1_700_000_000, 42]]
		expect(toChartRuntimeState({ data, isLoading: false, isError: true, refetch }, true, { status: 'ready' })).toEqual({
			data,
			isLoading: false,
			hasError: false,
			canRetry: false,
			refetch
		})
	})

	test('waits for the protocol catalog and retries its failure before starting a chart source', () => {
		const refetch = vi.fn()
		const retryCatalog = vi.fn()
		const query = { data: undefined, isLoading: false, isError: false, refetch }

		expect(toChartRuntimeState(query, true, { status: 'loading' })).toMatchObject({
			isLoading: true,
			hasError: false
		})
		expect(toChartRuntimeState(query, true, { status: 'error', retry: retryCatalog })).toEqual({
			data: [],
			isLoading: false,
			hasError: true,
			canRetry: true,
			refetch: retryCatalog
		})
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
			toChartRuntimeState({ data: undefined, isLoading: false, isError: false, refetch }, true, prerequisite)
		).toEqual({
			data: [],
			isLoading: false,
			hasError: false,
			canRetry: false,
			refetch
		})
	})
})
