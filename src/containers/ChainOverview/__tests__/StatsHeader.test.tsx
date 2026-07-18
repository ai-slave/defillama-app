import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { IChainOverviewData } from '../types'

function setupStatsMocks() {
	vi.doMock('next/router', () => ({
		useRouter: () => ({ asPath: '/chain/ethereum' })
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
		useFetchChainChartData: () => ({
			totalValueUSD: 0,
			change24h: null,
			valueChange24hUSD: null,
			finalCharts: {},
			valueSymbol: '$',
			isFetchingChartData: false,
			failedMetrics: []
		})
	}))
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
	it('renders the chain website link before the bookmark', async () => {
		setupStatsMocks()

		const { Stats } = await import('../Stats')
		const markup = renderToStaticMarkup(React.createElement(Stats, { ...statsProps, hideChart: true }))

		expect(markup).toContain('href="https://ethereum.org/"')
		expect(markup).toContain('aria-label="Ethereum website"')
		expect(markup.indexOf('aria-label="Ethereum website"')).toBeLessThan(markup.indexOf('BOOKMARK'))
	})
})
