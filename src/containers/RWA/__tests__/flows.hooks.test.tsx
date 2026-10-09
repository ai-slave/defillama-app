// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { waitForUi } from '~/utils/testing/waitForUi'
import {
	useRWAFlowSeries,
	useRWAFlowSummary,
	type RWAFlowSeriesRequest,
	type RWAFlowSeriesResult
} from '../flows.hooks'

const { fetchJsonMock } = vi.hoisted(() => ({ fetchJsonMock: vi.fn() }))

vi.mock('~/utils/async', async (importOriginal) => ({
	...(await importOriginal<typeof import('~/utils/async')>()),
	fetchJson: fetchJsonMock
}))

const SPLIT_ROWS = [{ timestamp: 1, Bonds: 3 }]
const ASSET_ROWS = [{ timestamp: 1, 'ondo/usdy': 3 }]

let unmount = async () => {}

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	fetchJsonMock.mockReset()
	fetchJsonMock.mockImplementation(async (url: string) => (url.includes('/overview?') ? SPLIT_ROWS : ASSET_ROWS))
})

afterEach(async () => {
	await unmount()
})

async function mount(Probe: () => null) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	const container = document.createElement('div')
	const root = createRoot(container)
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<Probe />
			</QueryClientProvider>
		)
	)
	unmount = async () => {
		await act(async () => root.unmount())
		client.clear()
	}
}

const requestedUrls = () => fetchJsonMock.mock.calls.map(([url]) => url)

async function renderFlowSeries(request: RWAFlowSeriesRequest) {
	const results: Array<RWAFlowSeriesResult> = []
	await mount(() => {
		results.push(useRWAFlowSeries(request))
		return null
	})
	await waitForUi(() => expect(results.at(-1)?.isLoading).toBe(false))
	return results.at(-1)
}

describe('useRWAFlowSummary', () => {
	test('a page that reads no flows does not download the summary', async () => {
		await mount(() => {
			useRWAFlowSummary(false)
			return null
		})

		expect(fetchJsonMock).not.toHaveBeenCalled()
	})
})

describe('useRWAFlowSeries', () => {
	test('reads the asset group split on the front page and never the unscoped asset breakdown', async () => {
		const result = await renderFlowSeries({
			scope: { kind: 'overview' },
			includeStablecoin: false,
			includeGovernance: true,
			enabled: true
		})

		expect(requestedUrls()).toEqual([
			'/api/public/rwa/flows/overview?splitBy=assetGroup&includeStablecoin=false&includeGovernance=true'
		])
		expect(result).toEqual({ splitPoints: SPLIT_ROWS, assetRows: undefined, isLoading: false, failedRead: null })
	})

	test('reads the split the Group by asks for', async () => {
		await renderFlowSeries({
			scope: { kind: 'overview' },
			splitBy: 'chain',
			includeStablecoin: false,
			includeGovernance: false,
			enabled: true
		})

		expect(requestedUrls()).toEqual([
			'/api/public/rwa/flows/overview?splitBy=chain&includeStablecoin=false&includeGovernance=false'
		])
	})

	test('reads the scoped asset breakdown on a scoped page and leaves the split off', async () => {
		const result = await renderFlowSeries({
			scope: { kind: 'platform', slug: 'Ondo' },
			includeStablecoin: false,
			includeGovernance: false,
			enabled: true
		})

		expect(requestedUrls()).toEqual(['/api/public/rwa/flows/asset-breakdown/platform/Ondo'])
		expect(result).toEqual({ splitPoints: undefined, assetRows: ASSET_ROWS, isLoading: false, failedRead: null })
	})

	test('requests nothing when the flows chart is not shown', async () => {
		await renderFlowSeries({
			scope: { kind: 'overview' },
			includeStablecoin: false,
			includeGovernance: false,
			enabled: false
		})

		expect(fetchJsonMock).not.toHaveBeenCalled()
	})
})
