import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { IChainOverviewData } from '../types'

function setupChainMocks({ user, query }: { user: unknown; query: Record<string, unknown> }) {
	vi.doMock('next/router', () => ({
		useRouter: () => ({ query, pathname: '/chain/[chain]', push: vi.fn() })
	}))
	vi.doMock('~/containers/Subscription/auth', () => ({
		useAuthContext: () => ({ user })
	}))
	vi.doMock('~/containers/Investors/InvestorRelationsView', () => ({
		InvestorRelationsView: () => React.createElement('div', null, 'IR-VIEW-MARKER')
	}))
	vi.doMock('~/components/RowLinksWithDropdown', () => ({
		RowLinksWithDropdown: () => null
	}))
	vi.doMock('~/components/EntityQuestionsStrip', () => ({
		EntityQuestionsStrip: () => null
	}))
	vi.doMock('~/components/Icon', () => ({
		Icon: () => null
	}))
	vi.doMock('~/components/Newsletter/NewsletterSignup', () => ({
		NewsletterSignup: () => null
	}))
	vi.doMock('~/components/TokenLogo', () => ({
		TokenLogo: () => null
	}))
	vi.doMock('~/containers/ProtocolRankings/Table', () => ({
		ChainProtocolsTable: () => null
	}))
	vi.doMock('../Stats', () => ({
		Stats: () => React.createElement('div', null, 'OVERVIEW-MARKER')
	}))
	vi.doMock('../SmolStats', () => ({
		SmolStats: () => null
	}))
	vi.doMock('~/components/QuestionHelper', () => ({
		QuestionHelper: () => null
	}))
}

const chainProps = (name: string) =>
	({
		allChains: [],
		metadata: { name },
		entityQuestions: [],
		isDataAvailable: true,
		protocols: []
	}) as unknown as IChainOverviewData

afterEach(() => {
	vi.clearAllMocks()
	vi.resetModules()
})

describe('Chain Investor Relations tab', () => {
	it('shows the Overview / Investor Relations tab row for an is_llama user on an IR chain', async () => {
		setupChainMocks({ user: { flags: { is_llama: true } }, query: {} })

		const { ChainOverview } = await import('../index')
		const markup = renderToStaticMarkup(React.createElement(ChainOverview, chainProps('NEAR')))

		expect(markup).toContain('Investor Relations')
		expect(markup).toContain('Overview')
		expect(markup).not.toContain('IR-VIEW-MARKER')
	})

	it('renders the Investor Relations view (not the Overview) when ?tab=investor-relations is set', async () => {
		setupChainMocks({ user: { flags: { is_llama: true } }, query: { tab: 'investor-relations' } })

		const { ChainOverview } = await import('../index')
		const markup = renderToStaticMarkup(React.createElement(ChainOverview, chainProps('NEAR')))

		// InvestorRelationsView is lazy-loaded; under renderToStaticMarkup it suspends to the null
		// fallback, so assert the Overview branch is NOT taken (its content is absent) instead.
		expect(markup).not.toContain('OVERVIEW-MARKER')
		expect(markup).toContain('Investor Relations')
	})

	it('hides the Investor Relations tab for a non-llama user', async () => {
		setupChainMocks({ user: null, query: {} })

		const { ChainOverview } = await import('../index')
		const markup = renderToStaticMarkup(React.createElement(ChainOverview, chainProps('NEAR')))

		expect(markup).not.toContain('Investor Relations')
	})

	it('does not render the IR view for a non-llama user even with the tab query', async () => {
		setupChainMocks({ user: null, query: { tab: 'investor-relations' } })

		const { ChainOverview } = await import('../index')
		const markup = renderToStaticMarkup(React.createElement(ChainOverview, chainProps('NEAR')))

		// Non-llama: irActive is false, so the Overview branch renders regardless of the tab query.
		expect(markup).not.toContain('IR-VIEW-MARKER')
		expect(markup).toContain('OVERVIEW-MARKER')
	})

	it('hides the Investor Relations tab on a chain without an IR dashboard', async () => {
		setupChainMocks({ user: { flags: { is_llama: true } }, query: {} })

		const { ChainOverview } = await import('../index')
		const markup = renderToStaticMarkup(React.createElement(ChainOverview, chainProps('Ethereum')))

		expect(markup).not.toContain('Investor Relations')
	})
})
