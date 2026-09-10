import type { GetStaticPropsContext } from 'next'
import { createElement, type ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { feeRevenueMetrics } from '~/metrics/feesRevenue'
import defillamaPages from '~/public/pages.json'
import { ADAPTER_DATA_TYPES, ADAPTER_TYPES } from '../constants'

type CapturedLayoutProps = {
	canonicalUrl?: string
	tvlOptions?: unknown
}

const mocks = vi.hoisted(() => ({
	chainMetadata: {
		ethereum: {
			id: 'ethereum',
			name: 'Ethereum'
		}
	},
	getChainsByAdapterPageData: vi.fn(),
	getChainsByChainNativeFeeRevenuePageData: vi.fn(),
	getChainsByREVPageData: vi.fn(),
	layoutProps: [] as Array<CapturedLayoutProps>,
	maxAgeForNext: vi.fn(() => 22)
}))

vi.mock('~/containers/AdapterMetrics/ChainsByAdapter', () => ({
	ChainsByAdapter: () => null
}))

vi.mock('~/components/DeprecatedEntityMarker', () => ({
	DeprecatedEntityMarker: () => null
}))

vi.mock('~/components/Link', () => ({
	BasicLink: () => null
}))

vi.mock('~/components/Table/TableWithSearch', () => ({
	TableWithSearch: () => null
}))

vi.mock('~/components/TokenLogo', () => ({
	TokenLogo: () => null
}))

vi.mock('~/containers/AdapterMetrics/queries', () => ({
	getChainsByAdapterPageData: mocks.getChainsByAdapterPageData,
	getChainsByChainNativeFeeRevenuePageData: mocks.getChainsByChainNativeFeeRevenuePageData,
	getChainsByREVPageData: mocks.getChainsByREVPageData
}))

vi.mock('~/layout', () => ({
	default: (props: CapturedLayoutProps) => {
		mocks.layoutProps.push(props)
		return null
	}
}))

vi.mock('~/utils/maxAgeForNext', () => ({
	maxAgeForNext: mocks.maxAgeForNext
}))

vi.mock('~/utils/metadata', () => ({
	default: {
		chainMetadata: mocks.chainMetadata
	}
}))

vi.mock('~/utils/perf', () => ({
	withPerformanceLogging: <T extends (...args: Array<unknown>) => unknown>(_name: string, fn: T) => fn
}))

const feeRevenueMetricRegistry = Object.values(feeRevenueMetrics)

const rankingPageRows = [
	{
		route: feeRevenueMetrics.chainFees.ranking.route,
		metric: feeRevenueMetrics.chainFees,
		loadPage: () => import('~/pages/fees/chains')
	},
	{
		route: feeRevenueMetrics.chainRevenue.ranking.route,
		metric: feeRevenueMetrics.chainRevenue,
		loadPage: () => import('~/pages/revenue/chains')
	},
	{
		route: feeRevenueMetrics.appFees.ranking.route,
		metric: feeRevenueMetrics.appFees,
		loadPage: () => import('~/pages/app-fees/chains')
	},
	{
		route: feeRevenueMetrics.appRevenue.ranking.route,
		metric: feeRevenueMetrics.appRevenue,
		loadPage: () => import('~/pages/app-revenue/chains')
	},
	{
		route: feeRevenueMetrics.rev.ranking.route,
		metric: feeRevenueMetrics.rev,
		loadPage: () => import('~/pages/rev/chains')
	}
] as const

const staticPropsContext = {} as GetStaticPropsContext
const chainRankingPageProps = {
	adapterType: ADAPTER_TYPES.FEES,
	chartData: { dimensions: ['timestamp'], source: [] },
	chains: [],
	allChains: []
}

describe('fees and revenue page semantics', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.layoutProps = []
		mocks.getChainsByAdapterPageData.mockResolvedValue({ chains: [] })
		mocks.getChainsByChainNativeFeeRevenuePageData.mockResolvedValue({ chains: [] })
		mocks.getChainsByREVPageData.mockResolvedValue({ chains: [] })
	})

	test('keeps every fees/revenue chain ranking page represented in the registry', () => {
		const pagesJsonRoutes = defillamaPages.Metrics.filter(
			(page) => page.category === 'Fees & Revenue' && page.tab === 'Chains'
		).map((page) => page.route)
		const registryRoutes = feeRevenueMetricRegistry.map((metric) => metric.ranking.route)

		expect([...pagesJsonRoutes].sort()).toEqual([...registryRoutes].sort())
	})

	test.each(feeRevenueMetricRegistry)('pins public page glossary semantics for $label', (metric) => {
		const matchingPages = defillamaPages.Metrics.filter((page) => page.route === metric.ranking.route)

		expect(matchingPages).toHaveLength(1)
		expect(matchingPages[0]).toMatchObject({
			name: metric.ranking.name,
			category: 'Fees & Revenue',
			tab: metric.ranking.tab,
			totalTrackedKey: metric.ranking.totalTrackedKey
		})

		for (const expectedText of metric.ranking.descriptionIncludes) {
			expect(matchingPages[0].description).toContain(expectedText)
		}
	})

	// Every builder a ranking page can dispatch to, so the unselected ones can be asserted untouched.
	const builders = [
		mocks.getChainsByChainNativeFeeRevenuePageData,
		mocks.getChainsByAdapterPageData,
		mocks.getChainsByREVPageData
	]

	test.each(rankingPageRows)('pins $route ranking page data builder semantics', async (row) => {
		const page = await row.loadPage()
		const ranking = row.metric.ranking

		await page.getStaticProps(staticPropsContext)

		// The switch picks the builder's expected call; the assertions run outside it, so a builder whose
		// case stopped matching fails rather than asserting nothing. The `never` default keeps it exhaustive.
		const expected = ((): { builder: (typeof builders)[number]; args: unknown } => {
			switch (ranking.builder) {
				case 'chain-native':
					return {
						builder: mocks.getChainsByChainNativeFeeRevenuePageData,
						args: {
							adapterType: ADAPTER_TYPES.FEES,
							dataType: ranking.dataType,
							chainMetadata: mocks.chainMetadata
						}
					}
				case 'app-aggregation':
					return {
						builder: mocks.getChainsByAdapterPageData,
						args: {
							adapterType: ADAPTER_TYPES.FEES,
							dataType: ranking.dataType,
							chainMetadata: mocks.chainMetadata,
							includeChartData: false
						}
					}
				case 'rev':
					return { builder: mocks.getChainsByREVPageData, args: { chainMetadata: mocks.chainMetadata } }
				default: {
					const exhaustiveCheck: never = ranking
					throw new Error(`Unhandled fee/revenue ranking builder: ${exhaustiveCheck}`)
				}
			}
		})()

		expect(expected.builder).toHaveBeenCalledWith(expected.args)
		for (const builder of builders.filter((candidate) => candidate !== expected.builder)) {
			expect(builder).not.toHaveBeenCalled()
		}
	})

	test('keeps fee/revenue ranking layouts free of metric filter controls', async () => {
		for (const row of rankingPageRows) {
			const page = await row.loadPage()
			const Page = page.default as unknown as ComponentType<Record<string, unknown>>

			mocks.layoutProps = []
			renderToStaticMarkup(
				createElement(
					Page,
					row.metric.ranking.builder === 'rev'
						? { chains: [] }
						: { ...chainRankingPageProps, dataType: row.metric.ranking.dataType }
				)
			)

			expect(mocks.layoutProps).toHaveLength(1)
			expect(mocks.layoutProps[0]).toMatchObject({ canonicalUrl: row.route })
			expect(mocks.layoutProps[0].tvlOptions).toBeUndefined()
		}
	})

	test('keeps holders revenue ranking layouts free of TVL filters', async () => {
		const page = await import('~/pages/holders-revenue/chains')
		const Page = page.default as unknown as ComponentType<Record<string, unknown>>

		renderToStaticMarkup(
			createElement(Page, {
				...chainRankingPageProps,
				dataType: ADAPTER_DATA_TYPES.DAILY_HOLDERS_REVENUE
			})
		)

		expect(mocks.layoutProps).toHaveLength(1)
		expect(mocks.layoutProps[0]).toMatchObject({ canonicalUrl: '/holders-revenue/chains' })
		expect(mocks.layoutProps[0].tvlOptions).toBeUndefined()
	})
})
