import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { IProtocolPageMetrics } from '../types'

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
	bribes: false,
	tokenTax: false,
	forks: false,
	governance: false,
	nfts: false,
	dev: false,
	inflows: false,
	liquidity: false,
	activeUsers: false,
	newUsers: false,
	txCount: false,
	gasUsed: false,
	liquidationVolume: false,
	collateralLiquidated: false,
	borrowed: false,
	tokenRights: false
}

function setupLayoutMocks(user: unknown) {
	vi.doMock('next/head', () => ({
		default: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children)
	}))
	vi.doMock('@ariakit/react', () => ({
		MenuProvider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
		MenuButton: ({ children }: { children: React.ReactNode }) => React.createElement('button', null, children),
		MenuButtonArrow: () => null,
		Menu: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
		PopoverDismiss: ({ children }: { children: React.ReactNode }) => React.createElement('button', null, children),
		MenuItem: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children)
	}))
	vi.doMock('~/components/EntityQuestionsStrip', () => ({
		EntityQuestionsStrip: () => React.createElement('div', null, 'QUESTIONS-MARKER')
	}))
	vi.doMock('~/ui/Icon', () => ({
		Icon: () => null
	}))
	vi.doMock('~/components/Link', () => ({
		BasicLink: ({ children, href }: { children: React.ReactNode; href: string }) =>
			React.createElement('a', { href }, children),
		ButtonLink: ({ children, href }: { children: React.ReactNode; href: string }) =>
			React.createElement('a', { href }, children)
	}))
	vi.doMock('~/components/TokenLogo', () => ({
		TokenLogo: () => null
	}))
	vi.doMock('~/ui/QuestionHelper', () => ({
		QuestionHelper: () => null
	}))
	vi.doMock('~/auth', () => ({
		useAuthContext: () => ({ user })
	}))
	vi.doMock('~/layout', () => ({
		default: ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children)
	}))
}

afterEach(() => {
	vi.clearAllMocks()
	vi.resetModules()
})

describe('Protocol Investor Relations tab', () => {
	it('shows the Investor Relations tab for an is_llama user on an IR protocol', async () => {
		setupLayoutMocks({ flags: { is_llama: true } })

		const { ProtocolOverviewLayout } = await import('../Layout')
		const markup = renderToStaticMarkup(
			React.createElement(
				ProtocolOverviewLayout as React.ComponentType<any>,
				{ name: 'Spark', category: 'Lending', metrics, tab: 'information' },
				null
			)
		)

		expect(markup).toContain('Investor Relations')
		expect(markup).toContain('href="/protocol/investor-relations/spark"')
	})

	it('hides the Investor Relations tab for a non-llama user', async () => {
		setupLayoutMocks(null)

		const { ProtocolOverviewLayout } = await import('../Layout')
		const markup = renderToStaticMarkup(
			React.createElement(
				ProtocolOverviewLayout as React.ComponentType<any>,
				{ name: 'Spark', category: 'Lending', metrics, tab: 'information' },
				null
			)
		)

		expect(markup).not.toContain('href="/protocol/investor-relations/spark"')
	})

	it('hides the Investor Relations tab on a protocol without an IR dashboard', async () => {
		setupLayoutMocks({ flags: { is_llama: true } })

		const { ProtocolOverviewLayout } = await import('../Layout')
		const markup = renderToStaticMarkup(
			React.createElement(
				ProtocolOverviewLayout as React.ComponentType<any>,
				{ name: 'Aave', category: 'Lending', metrics, tab: 'information' },
				null
			)
		)

		expect(markup).not.toContain('investor-relations')
	})

	it('suppresses the external IR announcement banner for is_llama users on Spark', async () => {
		setupLayoutMocks({ flags: { is_llama: true } })

		const { ProtocolOverviewLayout } = await import('../Layout')
		const markup = renderToStaticMarkup(
			React.createElement(
				ProtocolOverviewLayout as React.ComponentType<any>,
				{ name: 'Spark', category: 'Lending', metrics, tab: 'information' },
				null
			)
		)

		expect(markup).not.toContain('investors.defillama.com/spark')
	})

	it('still shows the external IR announcement banner for a non-llama user on Spark', async () => {
		setupLayoutMocks(null)

		const { ProtocolOverviewLayout } = await import('../Layout')
		const markup = renderToStaticMarkup(
			React.createElement(
				ProtocolOverviewLayout as React.ComponentType<any>,
				{ name: 'Spark', category: 'Lending', metrics, tab: 'information' },
				null
			)
		)

		expect(markup).toContain('investors.defillama.com/spark')
	})

	it('labels the IR tab "Enterprise Dashboard" for odyssey', async () => {
		setupLayoutMocks({ flags: { is_llama: true } })

		const { ProtocolOverviewLayout } = await import('../Layout')
		const markup = renderToStaticMarkup(
			React.createElement(
				ProtocolOverviewLayout as React.ComponentType<any>,
				{ name: 'Odyssey Finance', category: 'Yield', metrics, tab: 'information' },
				null
			)
		)

		expect(markup).toContain('Enterprise Dashboard')
		expect(markup).toContain('href="/protocol/investor-relations/odyssey-finance"')
	})
})
