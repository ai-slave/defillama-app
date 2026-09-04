import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProtocolTvlKey } from '../api.types'
import {
	useFetchProtocolActivityChart,
	useFetchProtocolChartsByKeys,
	useFetchProtocolMedianAPY,
	useFetchProtocolTVLChart
} from '../queries.client'
import type { IFetchProtocolChartsByKeysParams } from '../queries.client'

type CapturedQueryOptions = {
	queryKey: unknown[]
	queryFn: () => unknown
	enabled?: boolean
}

const mocks = vi.hoisted(() => ({
	fetchJson: vi.fn(),
	queryGroups: [] as Array<Array<CapturedQueryOptions>>,
	queryOptions: [] as Array<CapturedQueryOptions>
}))

vi.mock('@tanstack/react-query', () => {
	const runQuery = (options: CapturedQueryOptions) => {
		if (options.enabled !== false) {
			Promise.resolve(options.queryFn()).catch(() => undefined)
		}

		return {
			data: null,
			dataUpdatedAt: 0,
			error: null,
			isError: false,
			isLoading: false
		}
	}

	return {
		useQuery: (options: CapturedQueryOptions) => {
			mocks.queryOptions.push(options)
			return runQuery(options)
		},
		useQueries: ({ queries }: { queries: Array<CapturedQueryOptions> }) => {
			mocks.queryGroups.push(queries)
			return queries.map(runQuery)
		}
	}
})

vi.mock('~/utils/async', () => ({
	fetchJson: mocks.fetchJson
}))

function TVLChartProbe({
	protocol,
	chartKey,
	tokensToExclude,
	enabled
}: {
	protocol: string | null
	chartKey?: ProtocolTvlKey
	tokensToExclude?: string[]
	enabled?: boolean
}) {
	useFetchProtocolTVLChart({
		protocol,
		...(chartKey ? { key: chartKey } : {}),
		...(tokensToExclude ? { tokensToExclude } : {}),
		...(enabled === undefined ? {} : { enabled })
	})

	return null
}

function ChartBatchProbe(props: IFetchProtocolChartsByKeysParams) {
	useFetchProtocolChartsByKeys(props)

	return null
}

function ActivityChartProbe({
	protocol,
	queryKey = 'active-users',
	dataType
}: {
	protocol: string | null
	queryKey?: string
	dataType?: 'dailyGasUsedUsd'
}) {
	useFetchProtocolActivityChart({
		queryKey,
		protocol,
		adapterType: 'active-users',
		...(dataType ? { dataType } : {})
	})

	return null
}

function MedianApyProbe({ protocol }: { protocol: string | null }) {
	useFetchProtocolMedianAPY(protocol)
	return null
}

describe('ProtocolOverview client chart queries', () => {
	const getOnlyQueryOption = () => {
		const option = mocks.queryOptions[0]
		if (!option) throw new Error('Expected one query option')
		return option
	}

	const getFirstQueryGroup = () => {
		const group = mocks.queryGroups[0]
		if (!group) throw new Error('Expected a query group')
		return group
	}

	beforeEach(() => {
		vi.clearAllMocks()
		mocks.fetchJson.mockResolvedValue(null)
		mocks.queryGroups = []
		mocks.queryOptions = []
	})

	it('builds the current protocol TVL value chart query', () => {
		renderToStaticMarkup(<TVLChartProbe protocol="curve-dex" chartKey="pool2" />)

		expect(mocks.queryOptions).toHaveLength(1)
		expect(getOnlyQueryOption().queryKey).toEqual([
			'protocol-overview',
			'tvl-chart',
			'curve-dex',
			'pool2',
			undefined,
			undefined,
			undefined
		])
		expect(mocks.fetchJson).toHaveBeenCalledWith('/api/public/protocols/charts?kind=tvl&protocol=curve-dex&key=pool2')
	})

	it('adds own-token exclusions to every TVL batch query and cache key', () => {
		renderToStaticMarkup(<ChartBatchProbe protocol="gate" keys={[]} source="tvl" tokensToExclude={['GT']} />)

		expect(mocks.queryGroups.flat().map((query) => query.queryKey.at(-1))).toEqual(['GT', 'GT', 'GT', 'GT'])
		expect(mocks.fetchJson.mock.calls.map(([url]) => url)).toEqual([
			'/api/public/protocols/charts?kind=tvl&protocol=gate&tokensToExclude=GT',
			'/api/public/protocols/charts?kind=tvl&protocol=gate&breakdownType=chain-breakdown&tokensToExclude=GT',
			'/api/public/protocols/charts?kind=tvl&protocol=gate&breakdownType=token-breakdown&tokensToExclude=GT',
			'/api/public/protocols/charts?kind=tvl&protocol=gate&currency=token&breakdownType=token-breakdown&tokensToExclude=GT'
		])
	})

	it('canonicalizes duplicate and reordered exclusions for both cache identity and URLs', () => {
		renderToStaticMarkup(<TVLChartProbe protocol="gate" tokensToExclude={['MNT', 'GT', 'MNT']} />)
		const first = getOnlyQueryOption()

		mocks.queryOptions = []
		mocks.fetchJson.mockClear()
		renderToStaticMarkup(<TVLChartProbe protocol="gate" tokensToExclude={['GT', 'MNT']} />)
		const second = getOnlyQueryOption()

		expect(first.queryKey).toEqual(second.queryKey)
		expect(first.queryKey.at(-1)).toBe('GT,MNT')
		expect(mocks.fetchJson).toHaveBeenCalledWith(
			'/api/public/protocols/charts?kind=tvl&protocol=gate&tokensToExclude=GT%2CMNT'
		)
	})

	it('treats an empty exclusion list as the unfiltered own-token state', () => {
		renderToStaticMarkup(<TVLChartProbe protocol="gate" tokensToExclude={[]} />)

		expect(getOnlyQueryOption().queryKey.at(-1)).toBeUndefined()
		expect(mocks.fetchJson).toHaveBeenCalledWith('/api/public/protocols/charts?kind=tvl&protocol=gate')
	})

	it('builds the current protocol TVL batch queries for value and breakdown charts', () => {
		renderToStaticMarkup(<ChartBatchProbe protocol="aave" keys={['pool2', 'staking']} source="tvl" />)

		expect(mocks.queryGroups.map((group) => group.map((query) => query.queryKey[1]))).toEqual([
			['tvl-chart', 'tvl-chart', 'tvl-chart'],
			['tvl-chart', 'tvl-chart', 'tvl-chart'],
			['tvl-chart', 'tvl-chart', 'tvl-chart'],
			['tvl-chart', 'tvl-chart', 'tvl-chart']
		])
		expect(mocks.fetchJson.mock.calls.map(([url]) => url)).toEqual([
			'/api/public/protocols/charts?kind=tvl&protocol=aave',
			'/api/public/protocols/charts?kind=tvl&protocol=aave&key=pool2',
			'/api/public/protocols/charts?kind=tvl&protocol=aave&key=staking',
			'/api/public/protocols/charts?kind=tvl&protocol=aave&breakdownType=chain-breakdown',
			'/api/public/protocols/charts?kind=tvl&protocol=aave&key=pool2&breakdownType=chain-breakdown',
			'/api/public/protocols/charts?kind=tvl&protocol=aave&key=staking&breakdownType=chain-breakdown',
			'/api/public/protocols/charts?kind=tvl&protocol=aave&breakdownType=token-breakdown',
			'/api/public/protocols/charts?kind=tvl&protocol=aave&key=pool2&breakdownType=token-breakdown',
			'/api/public/protocols/charts?kind=tvl&protocol=aave&key=staking&breakdownType=token-breakdown',
			'/api/public/protocols/charts?kind=tvl&protocol=aave&currency=token&breakdownType=token-breakdown',
			'/api/public/protocols/charts?kind=tvl&protocol=aave&key=pool2&currency=token&breakdownType=token-breakdown',
			'/api/public/protocols/charts?kind=tvl&protocol=aave&key=staking&currency=token&breakdownType=token-breakdown'
		])
	})

	it('keeps treasury batch queries on the treasury source', () => {
		renderToStaticMarkup(
			<ChartBatchProbe protocol="makerdao" keys={['OwnTokens']} includeBase={false} source="treasury" inflows={false} />
		)

		expect(mocks.queryGroups).toHaveLength(4)
		expect(getFirstQueryGroup().map((query) => query.queryKey)).toEqual([
			['protocol-overview', 'treasury-chart', 'makerdao', 'OwnTokens', undefined, undefined, undefined]
		])
		expect(mocks.fetchJson.mock.calls.map(([url]) => url)).toEqual([
			'/api/public/protocols/charts?kind=treasury&protocol=makerdao&key=OwnTokens',
			'/api/public/protocols/charts?kind=treasury&protocol=makerdao&key=OwnTokens&breakdownType=chain-breakdown'
		])
	})

	it('does not fetch protocol chart data without a protocol', () => {
		renderToStaticMarkup(<TVLChartProbe protocol={null} />)

		expect(mocks.queryOptions).toHaveLength(1)
		expect(getOnlyQueryOption().enabled).toBe(false)
		expect(mocks.fetchJson).not.toHaveBeenCalled()
	})

	it('does not fetch protocol chart data for an empty protocol', () => {
		renderToStaticMarkup(<TVLChartProbe protocol="" />)

		expect(getOnlyQueryOption().enabled).toBe(false)
		expect(mocks.fetchJson).not.toHaveBeenCalled()
	})

	it('normalizes protocol activity chart rows to millisecond timestamps', async () => {
		mocks.fetchJson.mockResolvedValue([
			[1_700_000_000, 1],
			[1_700_000_100, 2]
		])

		renderToStaticMarkup(<ActivityChartProbe protocol="curve-dex" />)

		expect(getOnlyQueryOption().queryKey).toEqual(['protocol-overview', 'active-users', 'curve-dex'])
		await expect(getOnlyQueryOption().queryFn()).resolves.toEqual([
			[1_700_000_000_000, 1],
			[1_700_000_100_000, 2]
		])
	})

	it('requests the USD gas series without dropping sub-dollar values', async () => {
		mocks.fetchJson.mockResolvedValue([[1_700_000_000, 0.01]])

		renderToStaticMarkup(
			<ActivityChartProbe protocol="pangolin-v2" queryKey="gas-used-usd" dataType="dailyGasUsedUsd" />
		)

		expect(getOnlyQueryOption().queryKey).toEqual(['protocol-overview', 'gas-used-usd', 'pangolin-v2'])
		expect(mocks.fetchJson).toHaveBeenCalledWith(
			'/api/public/protocols/charts?kind=adapter&adapterType=active-users&protocol=pangolin-v2&dataType=dailyGasUsedUsd'
		)
		await expect(getOnlyQueryOption().queryFn()).resolves.toEqual([[1_700_000_000_000, 0.01]])
	})

	it('keeps successful empty activity and median responses distinct from failures', async () => {
		mocks.fetchJson.mockResolvedValue([])
		renderToStaticMarkup(<ActivityChartProbe protocol="curve-dex" />)
		await expect(getOnlyQueryOption().queryFn()).resolves.toEqual([])

		mocks.queryOptions = []
		renderToStaticMarkup(<MedianApyProbe protocol="curve-dex" />)
		await expect(getOnlyQueryOption().queryFn()).resolves.toEqual([])

		const upstreamError = new Error('upstream failed')
		mocks.fetchJson.mockRejectedValue(upstreamError)
		mocks.queryOptions = []
		renderToStaticMarkup(<ActivityChartProbe protocol="curve-dex" />)
		await expect(getOnlyQueryOption().queryFn()).rejects.toBe(upstreamError)

		mocks.queryOptions = []
		renderToStaticMarkup(<MedianApyProbe protocol="curve-dex" />)
		await expect(getOnlyQueryOption().queryFn()).rejects.toBe(upstreamError)
	})
})
