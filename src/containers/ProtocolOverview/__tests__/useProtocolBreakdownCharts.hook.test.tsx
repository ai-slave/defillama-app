// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type QueryState<T> = {
	data: T | undefined
	dataUpdatedAt: number
	errorUpdatedAt: number
	isError: boolean
	isLoading: boolean
	error: Error | null
}

const createQueryState = <T,>(data: T | undefined): QueryState<T> => ({
	data,
	dataUpdatedAt: data === undefined ? 0 : 1,
	errorUpdatedAt: 0,
	isError: false,
	isLoading: false,
	error: null
})

const mocks = vi.hoisted(() => ({
	result: {
		keysToFetch: [undefined] as Array<string | undefined>,
		tvlChartQueries: [] as Array<QueryState<Array<[number, number]>>>,
		chainBreakdownChartQueries: [] as Array<QueryState<Array<[number, Record<string, number>]>>>,
		tokenBreakdownUsdQueries: [] as Array<QueryState<Array<[number, Record<string, number>]>>>,
		tokenBreakdownRawQueries: [] as Array<QueryState<Array<[number, Record<string, number>]>>>
	}
}))

vi.mock('../queries.client', () => ({
	useFetchProtocolChartsByKeys: () => mocks.result
}))

import { useProtocolBreakdownCharts } from '../useProtocolBreakdownCharts'

type HookResult = ReturnType<typeof useProtocolBreakdownCharts>

function Harness({
	onRender,
	tokensToExclude
}: {
	onRender: (result: HookResult) => void
	tokensToExclude?: string[]
}) {
	onRender(
		useProtocolBreakdownCharts({
			protocol: 'test-protocol',
			keys: [],
			includeBase: true,
			inflows: false,
			...(tokensToExclude ? { tokensToExclude } : {})
		})
	)
	return null
}

describe('useProtocolBreakdownCharts query failure semantics', () => {
	let container: HTMLDivElement
	let root: Root
	let latest: HookResult | null = null
	let nextIdleCallbackId = 1
	let idleCallbacks = new Map<number, IdleRequestCallback>()

	const getLatest = () => {
		if (!latest) throw new Error('Expected hook result')
		return latest
	}

	const renderHarness = async (tokensToExclude?: string[]) => {
		await act(async () => {
			root.render(
				<Harness onRender={(result) => (latest = result)} {...(tokensToExclude ? { tokensToExclude } : {})} />
			)
		})
	}

	const runNextIdleCallback = async () => {
		const next = idleCallbacks.entries().next().value
		if (!next) throw new Error('Expected a scheduled idle callback')
		const [callbackId, callback] = next
		idleCallbacks.delete(callbackId)
		await act(async () => {
			callback({ didTimeout: false, timeRemaining: () => 50 })
		})
	}

	beforeEach(() => {
		Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true })
		nextIdleCallbackId = 1
		idleCallbacks = new Map()
		Object.defineProperty(window, 'requestIdleCallback', {
			configurable: true,
			value: (callback: IdleRequestCallback) => {
				const callbackId = nextIdleCallbackId++
				idleCallbacks.set(callbackId, callback)
				return callbackId
			}
		})
		Object.defineProperty(window, 'cancelIdleCallback', {
			configurable: true,
			value: (callbackId: number) => idleCallbacks.delete(callbackId)
		})
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		latest = null
		mocks.result.tvlChartQueries = [
			createQueryState([
				[1_000, 10],
				[2_000, 20]
			])
		]
		mocks.result.chainBreakdownChartQueries = [createQueryState([])]
		mocks.result.tokenBreakdownUsdQueries = []
		mocks.result.tokenBreakdownRawQueries = []
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT')
		Reflect.deleteProperty(window, 'requestIdleCallback')
		Reflect.deleteProperty(window, 'cancelIdleCallback')
	})

	it('retains cached source data on refetch error but clears a failed source with no data', async () => {
		await renderHarness()
		expect(getLatest().isLoading).toBe(true)
		await runNextIdleCallback()
		expect(getLatest().valueDataset?.source).toEqual([
			[1_000, 10],
			[2_000, 20]
		])

		const cachedError = new Error('Refetch failed')
		const successfulQuery = mocks.result.tvlChartQueries[0]
		if (!successfulQuery) throw new Error('Expected successful TVL query')
		mocks.result.tvlChartQueries = [
			{
				...successfulQuery,
				errorUpdatedAt: 2,
				isError: true,
				error: cachedError
			}
		]
		await renderHarness()
		expect(idleCallbacks.size).toBe(0)
		expect(getLatest().isLoading).toBe(false)
		expect(getLatest().valueDataset?.source).toEqual([
			[1_000, 10],
			[2_000, 20]
		])
		expect(getLatest().errors).toEqual([{ category: 'tvl', key: undefined, error: cachedError }])

		const retainedQuery = mocks.result.tvlChartQueries[0]
		if (!retainedQuery) throw new Error('Expected cached TVL query')
		mocks.result.tvlChartQueries = [
			{
				...retainedQuery,
				data: undefined,
				isLoading: true,
				isError: false,
				error: null
			}
		]
		await renderHarness()
		expect(getLatest().isLoading).toBe(true)
		expect(idleCallbacks.size).toBe(0)
		expect(getLatest().valueDataset?.source).toEqual([
			[1_000, 10],
			[2_000, 20]
		])

		const loadingQuery = mocks.result.tvlChartQueries[0]
		if (!loadingQuery) throw new Error('Expected loading TVL query')
		mocks.result.tvlChartQueries = [
			{
				...loadingQuery,
				errorUpdatedAt: 3,
				isLoading: false,
				isError: true,
				error: cachedError
			}
		]
		await renderHarness()
		expect(getLatest().isLoading).toBe(true)
		expect(getLatest().valueDataset?.source).toEqual([
			[1_000, 10],
			[2_000, 20]
		])
		await runNextIdleCallback()
		expect(getLatest().valueDataset).toBeNull()
		expect(getLatest().errors).toEqual([{ category: 'tvl', key: undefined, error: cachedError }])
	})

	it('recomputes when canonical token exclusions change with unchanged query timestamps', async () => {
		await renderHarness()
		await runNextIdleCallback()
		expect(idleCallbacks.size).toBe(0)
		expect(getLatest().valueDataset?.source).toEqual([
			[1_000, 10],
			[2_000, 20]
		])

		const initialQuery = mocks.result.tvlChartQueries[0]
		if (!initialQuery) throw new Error('Expected initial TVL query')
		mocks.result.tvlChartQueries = [
			{
				...initialQuery,
				data: [
					[1_000, 100],
					[2_000, 200]
				]
			}
		]

		await renderHarness(['GT'])
		expect(getLatest().isLoading).toBe(true)
		expect(idleCallbacks.size).toBe(1)
		await runNextIdleCallback()
		expect(getLatest().valueDataset?.source).toEqual([
			[1_000, 100],
			[2_000, 200]
		])

		const excludedQuery = mocks.result.tvlChartQueries[0]
		if (!excludedQuery) throw new Error('Expected excluded TVL query')
		mocks.result.tvlChartQueries = [
			{
				...excludedQuery,
				data: [
					[1_000, 1_000],
					[2_000, 2_000]
				]
			}
		]

		await renderHarness(['GT', 'GT'])
		expect(idleCallbacks.size).toBe(0)
		expect(getLatest().isLoading).toBe(false)
		expect(getLatest().valueDataset?.source).toEqual([
			[1_000, 100],
			[2_000, 200]
		])
	})
})
