import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, test, vi } from 'vitest'
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

function setupLayoutMocks(user: unknown) {
	vi.doMock('next/head', () => ({
		default: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children)
	}))
	vi.doMock('@ariakit/react', () => ({
		MenuProvider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
		MenuButton: ({ children }: { children: React.ReactNode }) =>
			React.createElement('button', { type: 'button' }, children),
		MenuButtonArrow: () => null,
		Menu: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
		PopoverDismiss: ({ children }: { children: React.ReactNode }) =>
			React.createElement('button', { type: 'button' }, children),
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
		ButtonLink: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) =>
			React.createElement('a', props, children)
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
	test('preserves Token Rights but ignores the retired governance flag in cached metrics', async () => {
		setupLayoutMocks(null)
		const { ProtocolOverviewLayout } = await import('../Layout')
		const cachedMetrics = { ...metrics, tokenRights: true, governance: true }
		const markup = renderToStaticMarkup(
			<ProtocolOverviewLayout name="Aave" category="Lending" metrics={cachedMetrics} tab="information">
				<div>Protocol overview</div>
			</ProtocolOverviewLayout>
		)

		expect(markup).toContain('href="/protocol/token-rights/aave"')
		expect(markup).toContain('href="/protocol/tvl/aave"')
		expect(markup).not.toContain('/protocol/governance')
		expect(markup).not.toContain('>Governance<')
	})

	test('shows the Enterprise tab on an IR protocol', async () => {
		setupLayoutMocks({ flags: { is_llama: true } })

		const { ProtocolOverviewLayout } = await import('../Layout')
		const markup = renderToStaticMarkup(
			React.createElement(
				ProtocolOverviewLayout as React.ComponentType<any>,
				{ name: 'Spark', category: 'Lending', metrics, tab: 'information' },
				null
			)
		)

		expect(markup).toContain('Enterprise')
		expect(markup).toContain('href="/protocol/investor-relations/spark"')
		expect(markup).toContain('data-umami-event="investor-relations-tab-click"')
		expect(markup).toContain('data-umami-event-entity-type="protocol"')
		expect(markup).toContain('data-umami-event-entity="spark"')
		expect(markup).toContain('data-umami-event-dashboard-id="9vn8xp43tdzo6gt"')
	})

	test('shows the Enterprise tab for a signed-out user', async () => {
		setupLayoutMocks(null)

		const { ProtocolOverviewLayout } = await import('../Layout')
		const markup = renderToStaticMarkup(
			React.createElement(
				ProtocolOverviewLayout as React.ComponentType<any>,
				{ name: 'Spark', category: 'Lending', metrics, tab: 'information' },
				null
			)
		)

		expect(markup).toContain('href="/protocol/investor-relations/spark"')
	})

	test('hides the Enterprise tab on a protocol without an IR dashboard', async () => {
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

	test('suppresses the external IR announcement banner for is_llama users on Spark', async () => {
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

	test('suppresses the external IR announcement banner for a signed-out user on Spark', async () => {
		setupLayoutMocks(null)

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

	test('labels the IR tab "Enterprise" for odyssey', async () => {
		setupLayoutMocks({ flags: { is_llama: true } })

		const { ProtocolOverviewLayout } = await import('../Layout')
		const markup = renderToStaticMarkup(
			React.createElement(
				ProtocolOverviewLayout as React.ComponentType<any>,
				{ name: 'Odyssey Finance', category: 'Yield', metrics, tab: 'information' },
				null
			)
		)

		expect(markup).toContain('Enterprise')
		expect(markup).toContain('href="/protocol/investor-relations/odyssey-finance"')
	})
})
