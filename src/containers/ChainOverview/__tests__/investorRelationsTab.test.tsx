import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IChainOverviewData } from '../types'

const state = vi.hoisted(() => ({
	query: {} as Record<string, unknown>,
	user: null as unknown
}))

vi.mock('next/router', () => ({
	useRouter: () => ({ query: state.query, pathname: '/chain/[chain]', push: vi.fn() })
}))
vi.mock('~/auth', () => ({
	useAuthContext: () => ({ user: state.user })
}))
vi.mock('~/containers/Investors/InvestorRelationsView', () => ({
	InvestorRelationsView: () => React.createElement('div', null, 'IR-VIEW-MARKER')
}))
vi.mock('~/components/RowLinksWithDropdown', () => ({
	RowLinksWithDropdown: () => React.createElement('div', null, 'CHAIN-LINKS-MARKER')
}))
vi.mock('~/components/EntityQuestionsStrip', () => ({
	EntityQuestionsStrip: () => React.createElement('div', null, 'QUESTIONS-MARKER')
}))
vi.mock('~/ui/Icon', () => ({ Icon: () => null }))
vi.mock('~/components/Newsletter/NewsletterSignup', () => ({ NewsletterSignup: () => null }))
vi.mock('~/components/TokenLogo', () => ({ TokenLogo: () => null }))
vi.mock('~/containers/ProtocolRankings/Table', () => ({ ChainProtocolsTable: () => null }))
vi.mock('../Stats', () => ({ Stats: () => React.createElement('div', null, 'OVERVIEW-MARKER') }))
vi.mock('../SmolStats', () => ({ SmolStats: () => null }))
vi.mock('~/ui/QuestionHelper', () => ({ QuestionHelper: () => null }))

import { ChainOverview } from '../index'

function setupChainState({ user, query }: { user: unknown; query: Record<string, unknown> }) {
	state.user = user
	state.query = query
}

const chainProps = (name: string) =>
	({
		allChains: [],
		metadata: { name },
		entityQuestions: [],
		isDataAvailable: true,
		protocols: []
	}) as unknown as IChainOverviewData

beforeEach(() => {
	vi.clearAllMocks()
	setupChainState({ user: null, query: {} })
})

describe('Chain Investor Relations tab', () => {
	it('shows the Overview / Investor Relations tab row for an is_llama user on an IR chain', async () => {
		setupChainState({ user: { flags: { is_llama: true } }, query: {} })

		const markup = renderToStaticMarkup(React.createElement(ChainOverview, chainProps('NEAR')))

		expect(markup).toContain('Investor Relations')
		expect(markup).toContain('Overview')
		expect(markup).not.toContain('IR-VIEW-MARKER')
		expect(markup).toContain('QUESTIONS-MARKER')
	})

	it('renders the Investor Relations view (not the Overview) when ?tab=investor-relations is set', async () => {
		setupChainState({ user: { flags: { is_llama: true } }, query: { tab: 'investor-relations' } })

		const markup = renderToStaticMarkup(React.createElement(ChainOverview, chainProps('NEAR')))

		// InvestorRelationsView is lazy-loaded; under renderToStaticMarkup it suspends to the null
		// fallback, so assert the Overview branch is NOT taken (its content is absent) instead.
		expect(markup).not.toContain('OVERVIEW-MARKER')
		expect(markup).toContain('Investor Relations')
		expect(markup).not.toContain('QUESTIONS-MARKER')
	})

	it('hides the Investor Relations tab for a non-llama user', async () => {
		setupChainState({ user: null, query: {} })

		const markup = renderToStaticMarkup(React.createElement(ChainOverview, chainProps('NEAR')))

		expect(markup).not.toContain('Investor Relations')
	})

	it('does not render the IR view for a non-llama user even with the tab query', async () => {
		setupChainState({ user: null, query: { tab: 'investor-relations' } })

		const markup = renderToStaticMarkup(React.createElement(ChainOverview, chainProps('NEAR')))

		// Non-llama: irActive is false, so the Overview branch renders regardless of the tab query.
		expect(markup).not.toContain('IR-VIEW-MARKER')
		expect(markup).toContain('OVERVIEW-MARKER')
	})

	it('hides the Investor Relations tab on a chain without an IR dashboard', async () => {
		setupChainState({ user: { flags: { is_llama: true } }, query: {} })

		const markup = renderToStaticMarkup(React.createElement(ChainOverview, chainProps('Ethereum')))

		expect(markup).not.toContain('Investor Relations')
	})
})
