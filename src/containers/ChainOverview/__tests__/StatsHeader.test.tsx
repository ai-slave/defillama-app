import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { IChainOverviewData } from '../types'

function setupStatsMocks(asPath = '/chain/ethereum') {
	const useFetchChainChartData = vi.fn(() => ({
		totalValueUSD: 0,
		change24h: null,
		valueChange24hUSD: null,
		finalCharts: {},
		valueSymbol: '$',
		isFetchingChartData: false,
		failedMetrics: []
	}))
	vi.doMock('next/router', () => ({
		useRouter: () => ({ asPath })
	}))
	vi.doMock('@tanstack/react-query', () => ({
		useMutation: () => ({ mutate: vi.fn(), isPending: false })
	}))
	vi.doMock('~/components/Bookmark', () => ({
		Bookmark: () => React.createElement('span', null, 'BOOKMARK')
	}))
	vi.doMock('~/components/CsvDownloadButton', () => ({
		CSVDownloadButton: () => null
	}))
	vi.doMock('~/ui/Icon', () => ({
		Icon: () => null
	}))
	vi.doMock('~/components/TokenLogo', () => ({
		TokenLogo: () => null
	}))
	vi.doMock('~/ui/Tooltip', () => ({
		Tooltip: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children)
	}))
	vi.doMock('~/auth', () => ({
		useAuthContext: () => ({ isAuthenticated: true })
	}))
	vi.doMock('~/contexts/LocalStorage', () => ({
		TVL_SETTINGS_KEYS: [],
		useDarkModeManager: () => [false],
		useLocalStorageSettingsManager: () => [{}]
	}))
	vi.doMock('../ChainChartPanel', () => ({
		ChainChartPanel: () => null
	}))
	vi.doMock('../KeyMetrics', () => ({
		KeyMetrics: () => null
	}))
	vi.doMock('../useFetchChainChartData', () => ({
		useFetchChainChartData
	}))
	return { useFetchChainChartData }
}

const statsProps = {
	chain: 'Ethereum',
	metadata: { name: 'Ethereum' },
	protocols: [],
	charts: ['TVL'],
	tvlChart: [],
	tvlChartSummary: {
		totalValueUSD: null,
		tvlPrevDay: null,
		valueChange24hUSD: null,
		change24h: null
	},
	extraTvlCharts: {
		staking: {},
		borrowed: {},
		pool2: {},
		vesting: {},
		offers: {},
		doublecounted: {},
		liquidstaking: {},
		dcAndLsOverlap: {}
	},
	chainTokenInfo: null,
	website: 'https://ethereum.org/'
} as unknown as IChainOverviewData

afterEach(() => {
	vi.clearAllMocks()
	vi.resetModules()
})

describe('ChainOverview Stats header', () => {
	test('renders the chain website link before the bookmark', async () => {
		setupStatsMocks()

		const { Stats } = await import('../Stats')
		const markup = renderToStaticMarkup(React.createElement(Stats, { ...statsProps, hideChart: true }))

		expect(markup).toContain('href="https://ethereum.org/"')
		expect(markup).toContain('aria-label="Open Ethereum website"')
		expect(markup).toContain('data-umami-event="chain-website-click"')
		expect(markup).toContain('data-umami-event-chain="Ethereum"')
		expect(markup).toContain('data-umami-event-placement="header"')
		expect(markup).toContain('xl:col-span-full')
		expect(markup.indexOf('aria-label="Open Ethereum website"')).toBeLessThan(markup.indexOf('BOOKMARK'))
	})

	test('uses the configured gas token for chain names with spaces', async () => {
		const { useFetchChainChartData } = setupStatsMocks('/chain/zksync-era')
		const { Stats } = await import('../Stats')

		renderToStaticMarkup(
			React.createElement(Stats, {
				...statsProps,
				chain: 'ZKsync Era',
				metadata: { id: 'zksync-era', name: 'ZKsync Era' }
			})
		)

		expect(useFetchChainChartData).toHaveBeenCalledWith(
			expect.objectContaining({ chainGeckoId: 'ethereum', denomination: 'USD' })
		)
	})

	test.each([
		['WEEKLY', 'weekly'],
		['hourly', 'daily']
	])('normalizes the %s chart grouping to %s', async (groupByParam, expectedGroupBy) => {
		const { useFetchChainChartData } = setupStatsMocks(`/chain/ethereum?groupBy=${groupByParam}`)
		const { Stats } = await import('../Stats')
		const charts: IChainOverviewData['charts'] = ['Chain Fees']

		renderToStaticMarkup(React.createElement(Stats, { ...statsProps, charts }))

		expect(useFetchChainChartData).toHaveBeenCalledWith(expect.objectContaining({ groupBy: expectedGroupBy }))
	})
})
