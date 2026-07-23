import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProtocolChartPage, { getStaticProps } from '~/pages/chart/protocol/[protocol]'

const mocks = vi.hoisted(() => ({
	routerState: {
		query: {} as Record<string, string | string[]>
	},
	useFetchProtocolChartData: vi.fn(),
	getProtocolOverviewPageData: vi.fn(),
	acquireOptionalYieldsSnapshot: vi.fn()
}))

vi.mock('next/router', () => ({
	useRouter: () => mocks.routerState
}))

vi.mock('~/ui/Loaders', () => ({
	LocalLoader: () => null
}))

vi.mock('~/containers/ProtocolOverview/Chart', () => ({
	default: () => null
}))

vi.mock('~/containers/ProtocolOverview/queries', () => ({
	getProtocolOverviewPageData: mocks.getProtocolOverviewPageData
}))

vi.mock('~/containers/ProtocolOverview/server/routes', () => ({
	resolveProtocolParamFromMetadata: vi.fn(() => ({
		id: 'test-protocol',
		canonicalSlug: 'test-protocol',
		metadata: { displayName: 'Test Protocol', yields: true }
	}))
}))

vi.mock('~/containers/Yields/server/dataset.server', () => ({
	acquireOptionalYieldsSnapshot: mocks.acquireOptionalYieldsSnapshot
}))

vi.mock('~/utils/metadata', () => ({
	default: {
		chainMetadata: {},
		tokenlist: {},
		cgExchangeIdentifiers: [],
		emissionsSupplyMetrics: {}
	}
}))

vi.mock('~/containers/ProtocolOverview/useFetchProtocolChartData', () => ({
	useFetchProtocolChartData: mocks.useFetchProtocolChartData
}))

vi.mock('~/utils/maxAgeForNext', () => ({
	maxAgeForNext: vi.fn(() => 22)
}))

vi.mock('~/utils/perf', () => ({
	withPerformanceLogging: <T extends (...args: Array<unknown>) => unknown>(_name: string, fn: T) => fn
}))

const createProps = () =>
	({
		name: 'Test Protocol',
		defaultToggledCharts: [],
		availableCharts: [],
		chartColors: {},
		hallmarks: null,
		token: { symbol: 'TEST' }
	}) as Parameters<typeof ProtocolChartPage>[0]

describe('chart/protocol/[protocol]', () => {
	beforeEach(() => {
		mocks.routerState.query = {}
		mocks.useFetchProtocolChartData.mockReset()
		mocks.useFetchProtocolChartData.mockReturnValue({
			finalCharts: {},
			valueSymbol: '$',
			loadingCharts: ''
		})
		mocks.getProtocolOverviewPageData.mockReset()
		mocks.acquireOptionalYieldsSnapshot.mockReset()
	})

	it('keeps the protocol chart page when the optional Yields snapshot is unavailable', async () => {
		const pageData = createProps()
		mocks.acquireOptionalYieldsSnapshot.mockResolvedValueOnce(null)
		mocks.getProtocolOverviewPageData.mockResolvedValueOnce(pageData)

		await expect(getStaticProps({ params: { protocol: 'test-protocol' } } as never)).resolves.toEqual({
			props: pageData,
			revalidate: 22
		})
		expect(mocks.getProtocolOverviewPageData).toHaveBeenCalledWith(expect.objectContaining({ yieldsSnapshot: null }))
	})

	it('parses TVL include query params as booleans', () => {
		mocks.routerState.query = {
			include_staking_in_tvl: 'false',
			include_pool2_in_tvl: '1'
		}

		renderToStaticMarkup(<ProtocolChartPage {...createProps()} />)

		expect(mocks.useFetchProtocolChartData.mock.calls[0][0].tvlSettings).toMatchObject({
			staking: false,
			pool2: true
		})
		expect(mocks.useFetchProtocolChartData.mock.calls[0][0]).not.toHaveProperty('feesSettings')
	})
})
