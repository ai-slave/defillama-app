// @vitest-environment happy-dom

import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { FEATURES_SERVER, SERVER_URL } from '~/constants'
import HomePage from '~/pages/pro'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'

const router = vi.hoisted(() => ({
	pathname: '/pro',
	query: {} as Record<string, string | Array<string>>,
	// Like the real router, a replace swaps the query the next render reads.
	replace: vi.fn(async ({ query }: { query: Record<string, string | Array<string>> }) => {
		router.query = query
		return true
	}),
	push: vi.fn(),
	isReady: true
}))
vi.mock('next/router', () => ({ useRouter: () => ({ ...router }) }))
// Page chrome and panel bodies are heavy children this test asserts nothing about.
vi.mock('~/layout', () => ({ default: ({ children }: { children: ReactNode }) => children }))
vi.mock('~/containers/ProDashboard/components/DashboardDiscovery', () => ({ DashboardDiscovery: () => null }))
vi.mock('~/containers/ProDashboard/components/AuthorProfileStrip', () => ({ AuthorProfileStrip: () => null }))
vi.mock('~/containers/ProDashboard/components/DashboardList', () => ({ DashboardList: () => null }))
vi.mock('~/containers/ProDashboard/components/FollowingShelves', () => ({ FollowingShelves: () => null }))
vi.mock('~/containers/ProDashboard/components/LikedDashboards', () => ({ LikedDashboards: () => null }))
vi.mock('~/containers/ProDashboard/components/MyProfileTab', () => ({ MyProfileTab: () => null }))
vi.mock('~/containers/ProDashboard/components/ComparisonWizard', () => ({ ComparisonWizard: () => null }))

const session = installSubscriberSession('user-1', { resolved: true })
const emptyPage = { items: [], page: 1, perPage: 20, totalItems: 0, totalPages: 0 }

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	router.replace.mockClear()
	session.serve({
		[`${FEATURES_SERVER}/dashboards`]: emptyPage,
		[`${FEATURES_SERVER}/lite/dashboards`]: { items: [] },
		'/team': { team: null },
		// The picker's catalogs load behind it; this test needs none of them.
		'/api/dynamic/pro-dashboard/protocol-catalog-source': [],
		[`${SERVER_URL}/lite/protocols2`]: { protocols: [], chains: [], parentProtocols: [] },
		[`${SERVER_URL}/chains`]: [],
		'/api/dynamic/adapter-metrics/perps': { protocols: [] },
		'/api/dynamic/adapter-metrics/dexs': { protocols: [] },
		'/api/dynamic/adapter-metrics/dex-aggregators': { protocols: [] }
	})
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

const dialogTitle = () => document.querySelector('[role="dialog"] h2, [role="dialog"] h1')?.textContent ?? null

test('a comparison link opens the comparison step until it closes, and a later Create opens the blank picker', async () => {
	router.query = { comparison: 'protocols', items: 'aave, uniswap,', tab: 'discover' }
	await act(async () =>
		root.render(
			<session.Wrapper>
				<HomePage initialDiscoveryCategories={{}} />
			</session.Wrapper>
		)
	)
	await waitForUi(() => expect(dialogTitle()).toBe('Create comparison dashboard'))
	expect(router.replace).not.toHaveBeenCalled()

	await act(async () =>
		document.querySelector<HTMLButtonElement>('[role="dialog"] button[aria-label="Close dialog"]')!.click()
	)
	expect(router.replace.mock.calls).toEqual([
		[{ pathname: '/pro', query: { tab: 'discover' } }, undefined, { shallow: true }]
	])
	// The next render reads the query without the link, as the real router's does.
	await act(async () =>
		root.render(
			<session.Wrapper>
				<HomePage initialDiscoveryCategories={{}} />
			</session.Wrapper>
		)
	)
	await waitForUi(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
	const create = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Create'))!
	await act(async () => create.click())
	await waitForUi(() => expect(dialogTitle()).toBe('Create new dashboard'))
})
