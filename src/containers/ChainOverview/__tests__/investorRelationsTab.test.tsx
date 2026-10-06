// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import type { IChainOverviewData } from '../types'

const router = vi.hoisted(() => ({
	query: {} as Record<string, string>,
	pathname: '/chain/[chain]',
	push: vi.fn()
}))
vi.mock('next/router', () => ({ useRouter: () => router }))
// Heavy children; these tests only check the tab row.
vi.mock('~/containers/Investors/InvestorRelationsView', () => ({ InvestorRelationsView: () => null }))
vi.mock('~/components/RowLinksWithDropdown', () => ({ RowLinksWithDropdown: () => null }))
vi.mock('~/components/EntityQuestionsStrip', () => ({ EntityQuestionsStrip: () => null }))
vi.mock('~/components/Newsletter/NewsletterSignup', () => ({ NewsletterSignup: () => null }))
vi.mock('~/containers/ProtocolRankings/Table', () => ({ ChainProtocolsTable: () => null }))
vi.mock('../Stats', () => ({ Stats: () => null }))
vi.mock('../SmolStats', () => ({ SmolStats: () => null }))

import { ChainOverview } from '../index'

const session = installSubscriberSession('chain-ir', { resolved: true })
let container: HTMLDivElement
let root: Root

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

async function render(name: string) {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<ChainOverview {...chainProps(name)} />
			</session.Wrapper>
		)
	)
}

function tabs(name: string) {
	const nav = container.querySelector(`nav[aria-label="${name} pages"]`)
	return Array.from(nav?.querySelectorAll('button') ?? [], (button) => ({
		name: button.textContent,
		current: button.getAttribute('aria-current')
	}))
}

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	router.query = {}
	router.push.mockReset()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

test('an IR chain opens the Enterprise tab from the Overview / Enterprise row', async () => {
	await render('NEAR')
	expect(tabs('NEAR')).toEqual([
		{ name: 'Overview', current: 'page' },
		{ name: 'Enterprise', current: null }
	])

	const enterprise = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Enterprise')!
	await act(async () => enterprise.click())
	expect(router.push).toHaveBeenCalledWith(
		{ pathname: '/chain/[chain]', query: { tab: 'investor-relations' } },
		undefined,
		{ shallow: true }
	)

	router.query = { tab: 'investor-relations' }
	await render('NEAR')
	expect(tabs('NEAR')).toEqual([
		{ name: 'Overview', current: null },
		{ name: 'Enterprise', current: 'page' }
	])
})

test('a chain without an IR dashboard shows no tab row', async () => {
	router.query = { tab: 'investor-relations' }
	await render('Ethereum')
	expect(container.querySelector('nav')).toBeNull()
})
