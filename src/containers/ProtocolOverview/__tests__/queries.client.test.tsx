import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
	useFetchProtocolActivityChart,
	useFetchProtocolChartsByKeys,
	useFetchProtocolTVLChart
} from '../queries.client'

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
			options.queryFn()
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
	currency,
	breakdownType,
	tokensToExclude,
	enabled
}: {
	protocol: string | null
	chartKey?: string
	currency?: string
	breakdownType?: 'chain-breakdown' | 'token-breakdown'
	tokensToExclude?: string[]
	enabled?: boolean
}) {
	useFetchProtocolTVLChart({
		protocol,
		key: chartKey,
		currency,
		breakdownType,
		tokensToExclude,
		enabled
	})

	return null
}

function ChartBatchProbe({
	protocol,
	keys,
	includeBase,
	source,
	inflows,
	chainBreakdown,
	tokensToExclude
}: {
	protocol: string | null
	keys: string[]
	includeBase?: boolean
	source: 'tvl' | 'treasury'
	inflows?: boolean
	chainBreakdown?: boolean
	tokensToExclude?: string[]
}) {
	useFetchProtocolChartsByKeys({
		protocol,
		keys,
		includeBase,
		source,
		inflows,
		chainBreakdown,
		tokensToExclude
	})

	return null
}

function ActivityChartProbe({ protocol }: { protocol: string | null }) {
	useFetchProtocolActivityChart({
		queryKey: 'active-users',
		protocol,
		adapterType: 'active-users'
	})

	return null
}

describe('ProtocolOverview client chart queries', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.fetchJson.mockResolvedValue(null)
		mocks.queryGroups = []
		mocks.queryOptions = []
	})

	it('builds the current protocol TVL value chart query', () => {
		renderToStaticMarkup(<TVLChartProbe protocol="curve-dex" chartKey="pool2" currency="ETH" />)

		expect(mocks.queryOptions).toHaveLength(1)
		expect(mocks.queryOptions[0].queryKey).toEqual([
			'protocol-overview',
			'tvl-chart',
			'curve-dex',
			'pool2',
			'ETH',
			undefined,
			undefined
		])
		expect(mocks.fetchJson).toHaveBeenCalledWith(
			'/api/public/protocols/charts?kind=tvl&protocol=curve-dex&key=pool2&currency=ETH'
		)
	})

	it.each([
		{
			breakdownType: 'chain-breakdown' as const,
			expectedUrl: '/api/public/protocols/charts?kind=tvl&protocol=curve-dex&key=borrowed&breakdownType=chain-breakdown'
		},
		{
			breakdownType: 'token-breakdown' as const,
			expectedUrl: '/api/public/protocols/charts?kind=tvl&protocol=curve-dex&key=borrowed&breakdownType=token-breakdown'
		}
	])('builds the current protocol TVL $breakdownType query', ({ breakdownType, expectedUrl }) => {
		renderToStaticMarkup(<TVLChartProbe protocol="curve-dex" chartKey="borrowed" breakdownType={breakdownType} />)

		expect(mocks.queryOptions).toHaveLength(1)
		expect(mocks.queryOptions[0].queryKey).toEqual([
			'protocol-overview',
			'tvl-chart',
			'curve-dex',
			'borrowed',
			undefined,
			breakdownType,
			undefined
		])
		expect(mocks.fetchJson).toHaveBeenCalledWith(expectedUrl)
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

	it('treats an empty exclusion list as the unfiltered own-token state', () => {
		renderToStaticMarkup(<TVLChartProbe protocol="gate" tokensToExclude={[]} />)

		expect(mocks.queryOptions[0].queryKey.at(-1)).toBeUndefined()
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
			<ChartBatchProbe protocol="makerdao" keys={['ownTokens']} includeBase={false} source="treasury" inflows={false} />
		)

		expect(mocks.queryGroups).toHaveLength(4)
		expect(mocks.queryGroups[0].map((query) => query.queryKey)).toEqual([
			['protocol-overview', 'treasury-chart', 'makerdao', 'ownTokens', undefined, undefined, undefined]
		])
		expect(mocks.fetchJson.mock.calls.map(([url]) => url)).toEqual([
			'/api/public/protocols/charts?kind=treasury&protocol=makerdao&key=ownTokens',
			'/api/public/protocols/charts?kind=treasury&protocol=makerdao&key=ownTokens&breakdownType=chain-breakdown'
		])
	})

	it('does not fetch protocol chart data without a protocol', () => {
		renderToStaticMarkup(<TVLChartProbe protocol={null} />)

		expect(mocks.queryOptions).toHaveLength(1)
		expect(mocks.queryOptions[0].enabled).toBe(false)
		expect(mocks.fetchJson).not.toHaveBeenCalled()
	})

	it('normalizes protocol activity chart rows to millisecond timestamps', async () => {
		mocks.fetchJson.mockResolvedValue([
			[1_700_000_000, 1],
			[1_700_000_100, 2]
		])

		renderToStaticMarkup(<ActivityChartProbe protocol="curve-dex" />)

		expect(mocks.queryOptions[0].queryKey).toEqual(['protocol-overview', 'active-users', 'curve-dex'])
		await expect(mocks.queryOptions[0].queryFn()).resolves.toEqual([
			[1_700_000_000_000, 1],
			[1_700_000_100_000, 2]
		])
	})
})
