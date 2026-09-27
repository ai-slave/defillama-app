// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
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

	test('shows the dollar change when the TVL change is tapped', async () => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		const container = document.createElement('div')
		document.body.append(container)
		const root = createRoot(container)
		const props = {
			...statsProps,
			// The TVL headline renders only for a chain with protocols.
			protocols: [{ name: 'Aave' }],
			tvlChartSummary: {
				totalValueUSD: 53_488_000_000,
				tvlPrevDay: 53_637_460_000,
				valueChange24hUSD: -149_460_000,
				change24h: -0.28
			}
		} as unknown as IChainOverviewData
		try {
			await act(async () =>
				root.render(
					<session.Wrapper>
						<Stats {...props} hideChart />
					</session.Wrapper>
				)
			)
			const change = [...container.querySelectorAll('span')].find((el) => el.textContent === '-0.28%')!
			await act(async () => change.dispatchEvent(new Event('touchstart', { bubbles: true })))
			await waitForUi(() => expect(document.querySelector('[role="tooltip"]')?.textContent).toBe('-$149.46m'))
		} finally {
			await act(async () => root.unmount())
			container.remove()
		}
	})
})
