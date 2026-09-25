// @vitest-environment happy-dom

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import type { IChainOverviewData } from '../types'

vi.mock('next/router', () => ({ useRouter: () => ({ query: {}, pathname: '/chain/[chain]', push: () => {} }) }))
// Heavy children; the render test only checks the tab row.
vi.mock('~/containers/Investors/InvestorRelationsView', () => ({ InvestorRelationsView: () => null }))
vi.mock('~/components/RowLinksWithDropdown', () => ({ RowLinksWithDropdown: () => null }))
vi.mock('~/components/EntityQuestionsStrip', () => ({ EntityQuestionsStrip: () => null }))
vi.mock('~/components/Newsletter/NewsletterSignup', () => ({ NewsletterSignup: () => null }))
vi.mock('~/containers/ProtocolRankings/Table', () => ({ ChainProtocolsTable: () => null }))
vi.mock('../Stats', () => ({ Stats: () => null }))
vi.mock('../SmolStats', () => ({ SmolStats: () => null }))

import { ChainOverview } from '../index'
import { getChainInvestorRelationsTab } from '../investorRelationsTab'

const session = installSubscriberSession('chain-ir')

const chainProps = (name: string) =>
	({
		allChains: [],
		metadata: { name },
		entityQuestions: [],
		isDataAvailable: true,
		protocols: [],
		protocolRankings: {
			nextCursor: null,
			snapshot: 'abcdefghijklmnopqrst',
			total: 0,
			hasMore: false,
			availableActivityMetrics: []
		}
	}) as unknown as IChainOverviewData

function render(name: string) {
	return renderToStaticMarkup(
		<session.Wrapper>
			<ChainOverview {...chainProps(name)} />
		</session.Wrapper>
	)
}

describe('Chain Investor Relations tab', () => {
	test('shows a tracked Overview / Enterprise tab row on the overview of an IR chain', () => {
		const markup = render('NEAR')

		expect(markup).toContain('Enterprise')
		expect(markup).toContain('data-umami-event="investor-relations-tab-click"')
		expect(markup).toContain('data-umami-event-entity="near"')
		expect(markup).toContain('data-umami-event-dashboard-id="n34rr3v3nu3d4sh"')
	})

	test('activates the Enterprise view only for ?tab=investor-relations on an IR chain', () => {
		expect(getChainInvestorRelationsTab('NEAR', undefined, false)).toMatchObject({
			dashboard: { dashboardId: 'n34rr3v3nu3d4sh' },
			active: false
		})
		expect(getChainInvestorRelationsTab('NEAR', 'investor-relations', false)?.active).toBe(true)
	})
})
