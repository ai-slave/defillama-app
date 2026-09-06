// @vitest-environment happy-dom

import type * as Ariakit from '@ariakit/react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import ProtocolChartPage, { getStaticProps } from '~/pages/chart/protocol/[protocol]'
import { ProtocolChartPanel } from '../ProtocolChartPanel'
import type { IProtocolOverviewPageData, IProtocolPageMetrics } from '../types'

const mocks = vi.hoisted(() => {
	const routerState: { query: Record<string, string | Array<string>>; asPath: string } = { query: {}, asPath: '' }
	return {
		routerState,
		useFetchProtocolChartData: vi.fn(),
		getProtocolOverviewPageData: vi.fn(),
		acquireOptionalYieldsSnapshot: vi.fn()
	}
})

vi.mock('next/router', () => ({
	useRouter: () => mocks.routerState
}))

vi.mock('@ariakit/react', async (importOriginal) => ({
	...(await importOriginal<typeof Ariakit>()),
	useDialogStore: () => ({ hide: vi.fn() }),
	DialogProvider: ({ children }: { children: React.ReactNode }) => children,
	DialogDisclosure: ({ children }: { children: React.ReactNode }) => children,
	Dialog: () => null
}))

vi.mock('~/components/AddToDashboard/AddToDashboardButton', () => ({ AddToDashboardButton: () => null }))
vi.mock('~/components/ChartExport/ChartExportButtons', () => ({ ChartExportButtons: () => null }))
vi.mock('~/components/EmbedChart', () => ({ EmbedChart: () => null }))

vi.mock('~/contexts/LocalStorage', () => ({
	useDarkModeManager: () => [false],
	useLocalStorageSettingsManager: () => [{}]
}))

vi.mock('~/hooks/useChartImageExport', () => ({
	useChartImageExport: () => ({ chartInstance: null, handleChartReady: vi.fn() })
}))

vi.mock('~/hooks/useIsClient', () => ({ useIsClient: () => false }))

vi.mock('~/ui/Tooltip', () => ({
	Tooltip: ({ children }: { children: React.ReactNode }) => children
}))

vi.mock('~/ui/Loaders', () => ({
	LocalLoader: () => null,
	LoadingDots: () => null,
	LoadingSpinner: () => null
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
	withPerformanceLogging: <T extends (...args: Array<never>) => Promise<object>>(_name: string, fn: T) => fn
}))

const metrics: IProtocolPageMetrics = {
	tvl: true,
	dexs: false,
	dexsNotionalVolume: false,
	perps: false,
	openInterest: false,
	optionsPremiumVolume: false,
	optionsNotionalVolume: false,
	dexAggregators: false,
	perpsAggregators: false,
	bridgeAggregators: false,
	stablecoins: false,
	bridge: false,
	treasury: false,
	unlocks: false,
	incentives: false,
	yields: false,
	fees: false,
	revenue: false,
	forks: false,
	nfts: false,
	dev: false,
	inflows: false,
	activeUsers: false,
	newUsers: false,
	txCount: false,
	gasUsed: false,
	liquidationVolume: false,
	collateralLiquidated: false,
	borrowed: false,
	tokenRights: false
}

const createProps = (): IProtocolOverviewPageData => ({
	initialMultiSeriesChartData: {},
	id: 'test-protocol',
	name: 'Test Protocol',
	token: {
		symbol: 'TEST',
		gecko_id: null,
		gecko_url: null,
		explorer_url: null
	},
	chains: null,
	currentTvlByChain: null,
	isOracleProtocol: false,
	oracleTvs: null,
	metrics,
	fees: null,
	revenue: null,
	holdersRevenue: null,
	dexVolume: null,
	dexNotionalVolume: null,
	dexAggregatorVolume: null,
	perpVolume: null,
	openInterest: null,
	perpAggregatorVolume: null,
	bridgeAggregatorVolume: null,
	optionsPremiumVolume: null,
	optionsNotionalVolume: null,
	liquidationVolume: null,
	collateralLiquidated: null,
	bridgeVolume: null,
	treasury: null,
	unlocks: null,
	yields: null,
	articles: null,
	raises: null,
	expenses: null,
	outstandingFDV: null,
	audits: null,
	hacks: [],
	chartDenominations: [],
	defaultToggledCharts: [],
	availableCharts: [],
	chartColors: {},
	hallmarks: [],
	rangeHallmarks: [],
	geckoId: null,
	seoTitle: 'Test Protocol',
	seoDescription: 'Test Protocol overview'
})

const getLastChartRequest = () => {
	const request = mocks.useFetchProtocolChartData.mock.calls.at(-1)?.[0]
	if (request === undefined) throw new Error('Expected protocol chart data request')
	return request
}

describe('chart/protocol/[protocol]', () => {
	beforeEach(() => {
		mocks.routerState.query = {}
		mocks.routerState.asPath = '/chart/protocol/test-protocol'
		mocks.useFetchProtocolChartData.mockReset()
		mocks.useFetchProtocolChartData.mockReturnValue({
			finalCharts: {},
			valueSymbol: '$',
			loadingCharts: [],
			failedMetrics: []
		})
		mocks.getProtocolOverviewPageData.mockReset()
		mocks.acquireOptionalYieldsSnapshot.mockReset()
	})

	test('keeps the protocol chart page when the optional Yields snapshot is unavailable', async () => {
		const pageData = createProps()
		mocks.acquireOptionalYieldsSnapshot.mockResolvedValueOnce(null)
		mocks.getProtocolOverviewPageData.mockResolvedValueOnce(pageData)

		await expect(getStaticProps({ params: { protocol: 'test-protocol' } })).resolves.toEqual({
			props: pageData,
			revalidate: 22
		})
		expect(mocks.getProtocolOverviewPageData).toHaveBeenCalledWith(expect.objectContaining({ yieldsSnapshot: null }))
	})

	test('parses TVL include query params as booleans', () => {
		mocks.routerState.query = {
			include_staking_in_tvl: 'false',
			include_pool2_in_tvl: '1',
			include_doublecounted_in_tvl: 'true',
			include_liquidstaking_in_tvl: 'true',
			include_govtokens_in_tvl: 'true'
		}

		renderToStaticMarkup(<ProtocolChartPage {...createProps()} />)

		const request = getLastChartRequest()
		expect(request.tvlSettings).toEqual({
			staking: false,
			borrowed: false,
			pool2: true,
			vesting: false
		})
		expect(request).not.toHaveProperty('feesSettings')
	})

	test('shares main-chart defaults, explicit TVL, events, interval, and denomination semantics', () => {
		mocks.routerState.query = { tvl: 'true', denomination: 'eth' }
		const props: IProtocolOverviewPageData = {
			...createProps(),
			availableCharts: ['TVL', 'Fees', 'Staking'],
			defaultToggledCharts: ['Fees', 'Staking'],
			chartDenominations: [{ symbol: 'USD' }, { symbol: 'ETH', geckoId: 'ethereum' }],
			hallmarks: [],
			rangeHallmarks: [[[1, 2], 'range']],
			defaultChartView: 'weekly'
		}

		renderToStaticMarkup(<ProtocolChartPage {...props} />)

		const request = getLastChartRequest()
		expect(request.toggledMetrics).toMatchObject({
			tvl: 'true',
			fees: 'true',
			staking_tvl: 'true',
			events: 'true',
			denomination: 'ETH'
		})
		expect(request.groupBy).toBe('weekly')
	})

	test('treats repeated main and embed query values as invalid instead of selecting the first value', async () => {
		const props: IProtocolOverviewPageData = {
			...createProps(),
			availableCharts: ['TVL', 'Fees'],
			defaultToggledCharts: ['Fees'],
			chartDenominations: [{ symbol: 'USD' }, { symbol: 'ETH', geckoId: 'ethereum' }],
			hallmarks: [[1, 'event']],
			defaultChartView: 'daily'
		}
		mocks.routerState.asPath =
			'/protocol/test-protocol?denomination=eth&denomination=usd&events=false&events=true&groupBy=monthly&groupBy=weekly&tvl=true&tvl=false&fees=false&fees=true'

		Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true })
		const container = document.createElement('div')
		document.body.appendChild(container)
		const root = createRoot(container)
		await act(async () => root.render(<ProtocolChartPanel {...props} />))
		const mainRequest = getLastChartRequest()
		await act(async () => root.unmount())
		container.remove()
		Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT')

		mocks.useFetchProtocolChartData.mockClear()
		mocks.routerState.query = {
			denomination: ['eth', 'usd'],
			events: ['false', 'true'],
			groupBy: ['monthly', 'weekly'],
			tvl: ['true', 'false'],
			fees: ['false', 'true']
		}
		renderToStaticMarkup(<ProtocolChartPage {...props} />)
		const embedRequest = getLastChartRequest()

		const expected = {
			denomination: null,
			events: 'true',
			tvl: 'false',
			fees: 'true'
		}
		expect(mainRequest.toggledMetrics).toMatchObject(expected)
		expect(embedRequest.toggledMetrics).toMatchObject(expected)
		expect(mainRequest.groupBy).toBe('daily')
		expect(embedRequest.groupBy).toBe('daily')
	})

	test('returns page data that survives a JSON round trip', async () => {
		const pageData: IProtocolOverviewPageData = {
			...createProps(),
			currentTvlByChain: { Ethereum: 100 },
			initialMultiSeriesChartData: { TVL: [[1_700_000_000_000, 100]] },
			availableCharts: ['TVL'],
			defaultToggledCharts: ['TVL'],
			chartColors: { TVL: '#000000' },
			chartDenominations: [{ symbol: 'USD', geckoId: null }]
		}
		mocks.acquireOptionalYieldsSnapshot.mockResolvedValueOnce(null)
		mocks.getProtocolOverviewPageData.mockResolvedValueOnce(pageData)

		const result = await getStaticProps({ params: { protocol: 'test-protocol' } })

		expect(JSON.parse(JSON.stringify(result))).toStrictEqual(result)
	})
})
