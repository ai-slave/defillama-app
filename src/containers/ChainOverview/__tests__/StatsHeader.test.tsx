// @vitest-environment happy-dom

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import { installSubscriberSession } from '~/utils/test/subscriberSession'
import type { IChainOverviewData } from '../types'
const session = installSubscriberSession('chain-header')
vi.mock('next/router', () => ({
	useRouter: () => ({ asPath: '/chain/ethereum', pathname: '/chain/[chain]', query: {} })
}))
vi.mock('../ChainChartPanel', () => ({ ChainChartPanel: () => null }))
vi.mock('../KeyMetrics', () => ({ KeyMetrics: () => null }))
import { Stats } from '../Stats'

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

describe('ChainOverview Stats header', () => {
	test('links the chain name to its official website', () => {
		const output = document.createElement('div')
		output.innerHTML = renderToStaticMarkup(
			<session.Wrapper>
				<Stats {...statsProps} hideChart />
			</session.Wrapper>
		)
		const link = output.querySelector('[aria-label="Open Ethereum website"]')
		expect(link?.getAttribute('href')).toBe('https://ethereum.org/')
	})
})
