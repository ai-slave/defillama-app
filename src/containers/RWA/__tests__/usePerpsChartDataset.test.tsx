import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { getRwaPerpsChartUrl, useRwaPerpsChartDataset } from '../usePerpsChartDataset'

const useQueryMock = vi.fn()
const fetchJsonMock = vi.fn()

vi.mock('@tanstack/react-query', () => ({
	useQuery: (options: unknown) => useQueryMock(options)
}))

vi.mock('~/utils/async', () => ({
	fetchJson: (...args: Array<unknown>) => fetchJsonMock(...args)
}))

type QueryOptions = { queryKey: Array<unknown>; queryFn: () => Promise<unknown>; enabled: boolean }

function Probe(props: Parameters<typeof useRwaPerpsChartDataset>[0]) {
	return <pre>{JSON.stringify(useRwaPerpsChartDataset(props))}</pre>
}

function render(props: Parameters<typeof useRwaPerpsChartDataset>[0]) {
	const markup = renderToStaticMarkup(<Probe {...props} />)
	return JSON.parse(markup.replace(/^<pre>|<\/pre>$/g, '').replace(/&quot;/g, '"'))
}

beforeEach(() => {
	useQueryMock.mockReset()
	fetchJsonMock.mockReset()
})

describe('getRwaPerpsChartUrl', () => {
	test('builds the split and contract routes with the server keys and the CEX flag', () => {
		expect(
			getRwaPerpsChartUrl({ source: { kind: 'split', breakdown: 'venue' }, metric: 'openInterest', includeCex: true })
		).toBe('/api/public/rwa/perps/overview-breakdown?breakdown=venue&key=openInterest&includeCex=true')
		expect(
			getRwaPerpsChartUrl({ source: { kind: 'split', breakdown: 'baseAsset' }, metric: 'volume', includeCex: false })
		).toBe('/api/public/rwa/perps/overview-breakdown?breakdown=baseAsset&key=volume24h')
		expect(getRwaPerpsChartUrl({ source: { kind: 'contracts' }, metric: 'openInterest', includeCex: false })).toBe(
			'/api/public/rwa/perps/contract-breakdown?key=openInterest'
		)
	})
})

describe('useRwaPerpsChartDataset', () => {
	test('fetches the url through the public route and turns the rows into a positional dataset', async () => {
		useQueryMock.mockReturnValue({
			data: { dimensions: ['timestamp', 'Hyperliquid', 'Aster'], source: [{ timestamp: 1, Hyperliquid: 2 }] },
			isLoading: false,
			error: null
		})
		const result = render({
			source: { kind: 'split', breakdown: 'venue' },
			metric: 'openInterest',
			includeCex: true,
			enabled: true
		})
		const options = useQueryMock.mock.calls[0]![0] as QueryOptions
		expect(options.queryKey).toEqual([
			'rwa-perps-chart',
			'/api/public/rwa/perps/overview-breakdown?breakdown=venue&key=openInterest&includeCex=true'
		])
		expect(options.enabled).toBe(true)
		await options.queryFn()
		expect(fetchJsonMock).toHaveBeenCalledWith(
			'/api/public/rwa/perps/overview-breakdown?breakdown=venue&key=openInterest&includeCex=true'
		)
		expect(result).toEqual({
			chartDataset: { dimensions: ['timestamp', 'Hyperliquid', 'Aster'], source: [[1, 2, null]] },
			isChartLoading: false,
			chartError: null
		})
	})

	test('stays empty and idle while disabled, and surfaces an error message', () => {
		useQueryMock.mockReturnValue({ data: undefined, isLoading: true, error: null })
		const idle = render({ source: { kind: 'contracts' }, metric: 'volume', includeCex: false, enabled: false })
		expect((useQueryMock.mock.calls[0]![0] as QueryOptions).enabled).toBe(false)
		expect(idle).toEqual({
			chartDataset: { source: [], dimensions: ['timestamp'] },
			isChartLoading: false,
			chartError: null
		})

		useQueryMock.mockReturnValue({ data: undefined, isLoading: false, error: new Error('upstream down') })
		const failed = render({ source: { kind: 'contracts' }, metric: 'volume', includeCex: false, enabled: true })
		expect(failed.chartError).toBe('upstream down')
		const cached = render({ source: { kind: 'contracts' }, metric: 'volume', includeCex: false, enabled: false })
		expect(cached.chartError).toBeNull()
	})
})
