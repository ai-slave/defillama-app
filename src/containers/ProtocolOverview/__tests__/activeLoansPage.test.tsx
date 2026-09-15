import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { IProtocolPageMetrics } from '../types'

const metrics = {
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
	dev: false,
	inflows: true,
	activeUsers: false,
	newUsers: false,
	txCount: false,
	gasUsed: false,
	liquidationVolume: false,
	collateralLiquidated: false,
	borrowed: true,
	tokenRights: false,
	rwa: false
} satisfies IProtocolPageMetrics

afterEach(() => {
	vi.clearAllMocks()
	vi.resetModules()
})

describe('active loans protocol page', () => {
	test('always requests the borrowed breakdown and exposes no protocol TVL controls', async () => {
		const breakdownRequests: Array<unknown> = []
		const layoutProps: Array<Record<string, unknown>> = []
		let persistedTvlSettings: Record<string, boolean> = {
			borrowed: false,
			doublecounted: false,
			liquidstaking: false,
			govtokens: false
		}

		vi.doMock('~/contexts/LocalStorage', () => ({
			useLocalStorageSettingsManager: () => [persistedTvlSettings]
		}))
		vi.doMock('../useProtocolBreakdownCharts', () => ({
			useProtocolBreakdownCharts: (request: unknown) => {
				breakdownRequests.push(request)
				return {
					isLoading: true,
					errors: [],
					chainsUnique: [],
					tokensUnique: [],
					rawTokensUnique: [],
					defaultRawTokens: [],
					chainBreakdown: null,
					tokenRawBreakdown: null,
					tokenBreakdownUSD: null,
					tokenBreakdownPieSeries: { peers: [], upstreamOthersValue: 0 }
				}
			}
		}))
		vi.doMock('../Layout', () => ({
			ProtocolOverviewLayout: ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => {
				layoutProps.push(props)
				return React.createElement(React.Fragment, null, children)
			}
		}))
		vi.doMock('~/components/TokenLogo', () => ({ TokenLogo: () => null }))
		vi.doMock('~/ui/EntityTitleStrip', () => ({ EntityTitleStrip: () => null }))
		vi.doMock('~/ui/Status', () => ({
			PanelLoadingStatus: () => null,
			PanelStatus: () => null
		}))

		const { default: ActiveLoansProtocol } = await import('~/pages/protocol/active-loans/[protocol]')
		const props = {
			name: 'Aave',
			otherProtocols: [],
			category: 'Lending',
			metrics,
			warningBanners: [],
			seoTitle: 'Aave Active Loans',
			seoDescription: 'Aave active loans'
		}

		renderToStaticMarkup(<ActiveLoansProtocol {...props} />)
		persistedTvlSettings = { borrowed: true, doublecounted: true, liquidstaking: true, govtokens: true }
		renderToStaticMarkup(<ActiveLoansProtocol {...props} />)

		expect(breakdownRequests).toEqual([
			{ protocol: 'aave', keys: ['borrowed'], includeBase: false, inflows: true, computeInflows: false },
			{ protocol: 'aave', keys: ['borrowed'], includeBase: false, inflows: true, computeInflows: false }
		])
		expect(layoutProps).toHaveLength(2)
		for (const capturedProps of layoutProps) {
			expect(capturedProps).not.toHaveProperty('toggleOptions')
			expect(capturedProps.tab).toBe('borrowed')
		}
	})

	test('reports a breakdown request failure instead of calling the missing data empty', async () => {
		vi.doMock('../useProtocolBreakdownCharts', () => ({
			useProtocolBreakdownCharts: () => ({
				isLoading: false,
				errors: [{ category: 'tvl', key: 'borrowed', error: new Error('request failed') }],
				chainsUnique: [],
				tokensUnique: [],
				rawTokensUnique: [],
				defaultRawTokens: [],
				chainBreakdown: null,
				tokenRawBreakdown: null,
				tokenBreakdownUSD: null,
				tokenBreakdownPieSeries: { peers: [], upstreamOthersValue: 0 }
			})
		}))
		vi.doMock('../Layout', () => ({
			ProtocolOverviewLayout: ({ children }: { children?: React.ReactNode }) =>
				React.createElement(React.Fragment, null, children)
		}))
		vi.doMock('~/components/TokenLogo', () => ({ TokenLogo: () => null }))
		vi.doMock('~/ui/EntityTitleStrip', () => ({ EntityTitleStrip: () => null }))
		vi.doMock('~/ui/Status', () => ({
			PanelLoadingStatus: () => null,
			PanelStatus: ({ children }: { children?: React.ReactNode }) => React.createElement('div', null, children)
		}))

		const { default: ActiveLoansProtocol } = await import('~/pages/protocol/active-loans/[protocol]')
		const markup = renderToStaticMarkup(
			<ActiveLoansProtocol
				name="Aave"
				otherProtocols={[]}
				category="Lending"
				metrics={metrics}
				warningBanners={[]}
				seoTitle="Aave Active Loans"
				seoDescription="Aave active loans"
			/>
		)

		expect(markup).toContain('Failed to fetch active loans breakdown APIs')
		expect(markup).not.toContain('Breakdown metrics are not available')
	})
})
