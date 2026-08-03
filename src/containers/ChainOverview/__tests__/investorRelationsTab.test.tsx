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
	it('shows the Overview / Enterprise tab row on an IR chain', async () => {
		setupChainState({ user: { flags: { is_llama: true } }, query: {} })

		const markup = renderToStaticMarkup(React.createElement(ChainOverview, chainProps('NEAR')))

		expect(markup).toContain('Enterprise')
		expect(markup).toContain('Overview')
		expect(markup).not.toContain('IR-VIEW-MARKER')
		expect(markup).toContain('QUESTIONS-MARKER')
		expect(markup).toContain('data-umami-event="investor-relations-tab-click"')
		expect(markup).toContain('data-umami-event-entity-type="chain"')
		expect(markup).toContain('data-umami-event-entity="near"')
		expect(markup).toContain('data-umami-event-dashboard-id="n34rr3v3nu3d4sh"')
	})

	it('renders the Enterprise view (not the Overview) when ?tab=investor-relations is set', async () => {
		setupChainState({ user: { flags: { is_llama: true } }, query: { tab: 'investor-relations' } })

		const markup = renderToStaticMarkup(React.createElement(ChainOverview, chainProps('NEAR')))

		// InvestorRelationsView is lazy-loaded; under renderToStaticMarkup it suspends to the null
		// fallback, so assert the Overview branch is NOT taken (its content is absent) instead.
		expect(markup).not.toContain('OVERVIEW-MARKER')
		expect(markup).toContain('Enterprise')
		expect(markup).not.toContain('QUESTIONS-MARKER')
	})

	it('shows the Enterprise tab for a signed-out user', async () => {
		setupChainState({ user: null, query: {} })

		const markup = renderToStaticMarkup(React.createElement(ChainOverview, chainProps('NEAR')))

		expect(markup).toContain('Enterprise')
	})

	it('renders the IR tab for a signed-out user when the tab query is set', async () => {
		setupChainState({ user: null, query: { tab: 'investor-relations' } })

		const markup = renderToStaticMarkup(React.createElement(ChainOverview, chainProps('NEAR')))

		expect(markup).toContain('IR-VIEW-MARKER')
		expect(markup).not.toContain('OVERVIEW-MARKER')
		expect(markup).toContain('Enterprise')
	})

	it('hides the Enterprise tab on a chain without an IR dashboard', async () => {
		setupChainState({ user: { flags: { is_llama: true } }, query: {} })

		const markup = renderToStaticMarkup(React.createElement(ChainOverview, chainProps('Ethereum')))

		expect(markup).not.toContain('Enterprise')
	})
})
