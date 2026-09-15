import type { NextApiRequest } from 'next'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createMockNextApiResponse } from '~/utils/test/nextApiMocks'

const {
	fetchProtocolTvlChartMock,
	fetchProtocolTreasuryChartMock,
	resolveProtocolParamMock,
	resolveCexParamMock,
	resolveBridgeProtocolParamMock,
	fetchAdapterProtocolChartDataMock,
	fetchAdapterProtocolChartDataByBreakdownTypeMock,
	getCachedCgChartDataMock,
	fetchBridgeVolumeBySlugMock,
	fetchOracleProtocolChartMock,
	getProtocolEmissionsChartsMock,
	fetchJsonMock
} = vi.hoisted(() => ({
	fetchProtocolTvlChartMock: vi.fn(),
	fetchProtocolTreasuryChartMock: vi.fn(),
	resolveProtocolParamMock: vi.fn(),
	resolveCexParamMock: vi.fn(),
	resolveBridgeProtocolParamMock: vi.fn(),
	fetchAdapterProtocolChartDataMock: vi.fn(),
	fetchAdapterProtocolChartDataByBreakdownTypeMock: vi.fn(),
	getCachedCgChartDataMock: vi.fn(),
	fetchBridgeVolumeBySlugMock: vi.fn(),
	fetchOracleProtocolChartMock: vi.fn(),
	getProtocolEmissionsChartsMock: vi.fn(),
	fetchJsonMock: vi.fn()
}))

vi.mock('~/api/coingecko', () => ({
	getCachedCgChartData: getCachedCgChartDataMock
}))

vi.mock('~/containers/AdapterMetrics/api', () => ({
	fetchAdapterProtocolChartData: fetchAdapterProtocolChartDataMock,
	fetchAdapterProtocolChartDataByBreakdownType: fetchAdapterProtocolChartDataByBreakdownTypeMock
}))

vi.mock('~/containers/Bridges/api', () => ({
	fetchBridgeVolumeBySlug: fetchBridgeVolumeBySlugMock
}))

vi.mock('~/containers/Bridges/server/routes', () => ({
	resolveBridgeProtocolParamFromMetadata: resolveBridgeProtocolParamMock
}))

vi.mock('~/containers/Oracles/api', () => ({
	fetchOracleProtocolChart: fetchOracleProtocolChartMock
}))

vi.mock('~/containers/ProtocolOverview/api', () => ({
	fetchProtocolTvlChart: fetchProtocolTvlChartMock,
	fetchProtocolTreasuryChart: fetchProtocolTreasuryChartMock
}))

vi.mock('~/containers/Unlocks/queries', () => ({
	getProtocolEmissionsCharts: getProtocolEmissionsChartsMock
}))

vi.mock('~/containers/Cexs/server/routes', () => ({
	resolveCexParamFromMetadata: resolveCexParamMock
}))

vi.mock('~/containers/ProtocolOverview/server/routes', () => ({
	resolveProtocolParamFromMetadata: resolveProtocolParamMock
}))

vi.mock('~/utils/metadata', () => ({
	__esModule: true,
	default: { oracleRoutes: { oracleNameBySlug: { chainlink: 'Chainlink' } } }
}))

vi.mock('~/utils/async', async (importOriginal) => {
	const actual = await importOriginal<typeof import('~/utils/async')>()
	return {
		...actual,
		fetchJson: fetchJsonMock
	}
})

vi.mock('~/utils/telemetry', () => ({
	recordRouteRuntimeError: vi.fn(),
	withApiRouteTelemetry: (_route: string, handler: unknown) => handler
}))

import handler from '~/pages/api/public/protocols/charts'

function createRequest(query: NextApiRequest['query']): NextApiRequest {
	return { method: 'GET', query } as NextApiRequest
}

beforeEach(() => {
	vi.clearAllMocks()
	fetchProtocolTvlChartMock.mockResolvedValue([])
	fetchProtocolTreasuryChartMock.mockResolvedValue([])
	resolveProtocolParamMock.mockReturnValue({ canonicalSlug: 'aave', id: '1', metadata: { displayName: 'Aave' } })
	resolveCexParamMock.mockReturnValue(null)
	resolveBridgeProtocolParamMock.mockReturnValue('stargate')
	fetchJsonMock.mockResolvedValue({ data: [] })
	fetchBridgeVolumeBySlugMock.mockResolvedValue({ bridge: {}, dailyVolumes: [] })
	fetchOracleProtocolChartMock.mockResolvedValue([])
})

describe('/api/public/protocols/charts', () => {
	test('returns 500 when the RWA upstream fails', async () => {
		fetchJsonMock.mockRejectedValueOnce(new Error('RWA unavailable'))
		const res = createMockNextApiResponse()
		await handler(createRequest({ kind: 'rwa-aum', platform: 'xstocks' }), res)
		expect(res.status).toHaveBeenCalledWith(500)
		expect(res.json).toHaveBeenCalledWith({ error: 'Failed to load protocol chart data' })
	})

	test('returns a successful empty chart when the RWA upstream has no history', async () => {
		fetchJsonMock.mockResolvedValueOnce([])
		const res = createMockNextApiResponse()
		await handler(createRequest({ kind: 'rwa-aum', platform: 'xstocks' }), res)
		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith([])
	})

	test('rejects retired governance chart requests without fetching upstream data', async () => {
		const req = createRequest({ kind: 'governance', apis: JSON.stringify(['https://example.com/governance']) })
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(res.status).toHaveBeenCalledWith(400)
		expect(res.json).toHaveBeenCalledWith({ error: 'Unsupported kind: governance' })
		expect(fetchJsonMock).not.toHaveBeenCalled()
	})

	test('rejects the retired governance POST transport', async () => {
		const req = createRequest({})
		req.method = 'POST'
		req.body = { kind: 'governance', apis: ['https://example.com/governance'] }
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(res.status).toHaveBeenCalledWith(405)
		expect(res.setHeader).toHaveBeenCalledWith('Allow', 'GET')
		expect(fetchJsonMock).not.toHaveBeenCalled()
	})

	test.each([
		{
			label: 'TVL value chart',
			kind: 'tvl',
			query: { key: 'pool2', tokensToExclude: 'GT,MNT' },
			expected: { protocol: 'aave', key: 'pool2', tokensToExclude: ['GT', 'MNT'] },
			fetcher: fetchProtocolTvlChartMock,
			oppositeFetcher: fetchProtocolTreasuryChartMock
		},
		{
			label: 'TVL chain breakdown chart',
			kind: 'tvl',
			query: { key: 'borrowed', breakdownType: 'chain-breakdown' },
			expected: { protocol: 'aave', key: 'borrowed', breakdownType: 'chain-breakdown' },
			fetcher: fetchProtocolTvlChartMock,
			oppositeFetcher: fetchProtocolTreasuryChartMock
		},
		{
			label: 'TVL token breakdown chart',
			kind: 'tvl',
			query: { key: 'staking', currency: 'token', breakdownType: 'token-breakdown' },
			expected: { protocol: 'aave', key: 'staking', currency: 'token', breakdownType: 'token-breakdown' },
			fetcher: fetchProtocolTvlChartMock,
			oppositeFetcher: fetchProtocolTreasuryChartMock
		},
		{
			label: 'TVL raw token breakdown chart',
			kind: 'tvl',
			query: { currency: 'raw', breakdownType: 'token-breakdown' },
			expected: { protocol: 'aave', currency: 'raw', breakdownType: 'token-breakdown' },
			fetcher: fetchProtocolTvlChartMock,
			oppositeFetcher: fetchProtocolTreasuryChartMock
		},
		{
			label: 'treasury value chart',
			kind: 'treasury',
			query: { key: 'OwnTokens' },
			expected: { protocol: 'aave', key: 'OwnTokens' },
			fetcher: fetchProtocolTreasuryChartMock,
			oppositeFetcher: fetchProtocolTvlChartMock
		},
		{
			label: 'treasury chain breakdown chart',
			kind: 'treasury',
			query: { key: 'OwnTokens', breakdownType: 'chain-breakdown' },
			expected: { protocol: 'aave', key: 'OwnTokens', breakdownType: 'chain-breakdown' },
			fetcher: fetchProtocolTreasuryChartMock,
			oppositeFetcher: fetchProtocolTvlChartMock
		},
		{
			label: 'treasury token breakdown chart',
			kind: 'treasury',
			query: { key: 'OwnTokens', currency: 'token', breakdownType: 'token-breakdown' },
			expected: { protocol: 'aave', key: 'OwnTokens', currency: 'token', breakdownType: 'token-breakdown' },
			fetcher: fetchProtocolTreasuryChartMock,
			oppositeFetcher: fetchProtocolTvlChartMock
		},
		{
			label: 'treasury USD token breakdown chart',
			kind: 'treasury',
			query: { currency: 'usd', breakdownType: 'token-breakdown' },
			expected: { protocol: 'aave', currency: 'usd', breakdownType: 'token-breakdown' },
			fetcher: fetchProtocolTreasuryChartMock,
			oppositeFetcher: fetchProtocolTvlChartMock
		}
	])('dispatches $label requests to the matching ProtocolOverview fetcher', async (row) => {
		const req = createRequest({ kind: row.kind, protocol: 'Aave V3', ...row.query })
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(resolveProtocolParamMock).toHaveBeenCalledWith('Aave V3', expect.any(Object))
		expect(row.fetcher).toHaveBeenCalledWith(row.expected)
		expect(row.oppositeFetcher).not.toHaveBeenCalled()
		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith([])
	})

	test('does not fetch TVL or treasury charts for unknown protocols', async () => {
		resolveProtocolParamMock.mockReturnValue(null)
		resolveCexParamMock.mockReturnValue(null)
		const req = createRequest({ kind: 'treasury', protocol: 'missing', key: 'OwnTokens' })
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(fetchProtocolTvlChartMock).not.toHaveBeenCalled()
		expect(fetchProtocolTreasuryChartMock).not.toHaveBeenCalled()
		expect(res.status).toHaveBeenCalledWith(404)
		expect(res.json).toHaveBeenCalledWith({ error: 'protocol not found' })
	})

	test.each([
		['tvl', { key: 'doublecounted' }, 'Invalid tvl key: doublecounted'],
		['tvl', { key: 'liquidstaking' }, 'Invalid tvl key: liquidstaking'],
		['tvl', { key: 'govtokens' }, 'Invalid tvl key: govtokens'],
		['treasury', { key: 'ownTokens' }, 'Invalid treasury key: ownTokens'],
		['tvl', { breakdownType: 'chain' }, 'Invalid breakdownType: chain'],
		['tvl', { currency: 'token' }, 'currency is only supported for token-breakdown charts'],
		['treasury', { tokensToExclude: 'AAVE' }, 'tokensToExclude is only supported for tvl charts']
	])('rejects unsupported %s chart request combinations', async (kind, query, error) => {
		const req = createRequest({ kind, protocol: 'Aave', ...query })
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(fetchProtocolTvlChartMock).not.toHaveBeenCalled()
		expect(fetchProtocolTreasuryChartMock).not.toHaveBeenCalled()
		expect(res.status).toHaveBeenCalledWith(400)
		expect(res.json).toHaveBeenCalledWith({ error })
	})

	test('falls back to CEX route cache entries for protocol chart requests', async () => {
		resolveProtocolParamMock.mockReturnValue(null)
		resolveCexParamMock.mockReturnValue({
			canonicalSlug: 'binance',
			id: 'cex-1',
			metadata: { displayName: 'Binance' }
		})
		const req = createRequest({ kind: 'tvl', protocol: 'Binance' })
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(resolveProtocolParamMock).toHaveBeenCalledWith('Binance', expect.any(Object))
		expect(resolveCexParamMock).toHaveBeenCalledWith('Binance', expect.any(Object))
		expect(fetchProtocolTvlChartMock).toHaveBeenCalledWith({ protocol: 'binance' })
		expect(fetchProtocolTreasuryChartMock).not.toHaveBeenCalled()
		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith([])
	})

	test('rejects the retired NFT volume chart kind', async () => {
		const res = createMockNextApiResponse()
		await handler(createRequest({ kind: 'nft-volume', protocol: 'OpenSea' }), res)
		expect(res.status).toHaveBeenCalledWith(400)
		expect(res.json).toHaveBeenCalledWith({ error: 'Unsupported kind: nft-volume' })
		expect(fetchJsonMock).not.toHaveBeenCalled()
	})

	test.each([
		['median-apy', 'aave-v3'],
		['bridge-volume', 'Stargate'],
		['oracle-chart', 'Chainlink']
	])('keeps successful empty %s producer results as empty charts', async (kind, protocol) => {
		const req = createRequest({ kind, protocol })
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith([])
	})

	test.each([
		['median-apy', 'aave-v3', () => fetchJsonMock.mockRejectedValueOnce(new Error('median failed'))],
		['bridge-volume', 'Stargate', () => fetchBridgeVolumeBySlugMock.mockRejectedValueOnce(new Error('bridge failed'))],
		['oracle-chart', 'Chainlink', () => fetchOracleProtocolChartMock.mockRejectedValueOnce(new Error('oracle failed'))]
	])('returns an error instead of a successful null %s chart when its producer fails', async (kind, protocol, fail) => {
		fail()
		const req = createRequest({ kind, protocol })
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(res.status).toHaveBeenCalledWith(500)
		expect(res.json).toHaveBeenCalledWith({ error: 'Failed to load protocol chart data' })
	})
})
