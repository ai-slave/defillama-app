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
	vi.doMock('~/components/WebsiteGlobeLink', () => ({
		WebsiteGlobeLink: ({
			url,
			name,
			event,
			eventData
		}: {
			url: string
			name: string
			event: string
			eventData: Record<string, string>
		}) =>
			React.createElement('a', {
				href: url,
				'aria-label': `Open ${name} website`,
				'data-umami-event': event,
				'data-umami-event-placement': 'header',
				...Object.fromEntries(Object.entries(eventData).map(([key, value]) => [`data-umami-event-${key}`, value]))
			})
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
				metadata: { id: 'zksync-era', name: 'ZKsync Era', gasTokenGeckoId: 'ethereum', gasTokenSymbol: 'ETH' }
			})
		)

		expect(useFetchChainChartData).toHaveBeenCalledWith(
			expect.objectContaining({ chainGeckoId: null, gasTokenGeckoId: 'ethereum', denomination: 'USD' })
		)
	})

	test.each([
		['eth', 'ETH'],
		['ARB', 'USD']
	])('resolves currency %s against gas metadata', async (currency, denomination) => {
		const { useFetchChainChartData } = setupStatsMocks(`/chain/arbitrum?currency=${currency}`)
		const { Stats } = await import('../Stats')
		renderToStaticMarkup(
			React.createElement(Stats, {
				...statsProps,
				metadata: { id: 'arbitrum', name: 'Arbitrum', gasTokenGeckoId: 'ethereum', gasTokenSymbol: 'ETH' },
				chainTokenInfo: {
					gecko_id: 'arbitrum',
					token_symbol: 'ARB',
					current_price: null,
					market_cap: null,
					fully_diluted_valuation: null
				}
			})
		)
		expect(useFetchChainChartData).toHaveBeenCalledWith(
			expect.objectContaining({
				chainGeckoId: 'arbitrum',
				gasTokenGeckoId: 'ethereum',
				denomination
			})
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
