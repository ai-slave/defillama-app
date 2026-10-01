// @vitest-environment happy-dom
import type { ParsedUrlQuery } from 'node:querystring'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { FEATURES_SERVER } from '~/constants'
import { renderHydrated } from '~/utils/testing/hydration'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import type { Dashboard } from '../dashboardTypes'
import { ProDashboardAPIProvider, useProDashboardVariables } from '../ProDashboardAPIContext'

const router = vi.hoisted(() => ({
	pathname: '/pro/[dashboardId]/[[...mode]]',
	asPath: '/pro/chains',
	query: {} as ParsedUrlQuery,
	push: vi.fn(),
	// Applies the written query, as the pages router does once a shallow replace settles.
	replace: vi.fn(async ({ query }: { query: ParsedUrlQuery }) => {
		router.query = query
		return true
	})
}))
vi.mock('next/router', () => ({ default: router, useRouter: () => router }))

const session = installSubscriberSession('viewer', { resolved: true })
const dashboard: Dashboard = {
	id: 'chains',
	user: 'owner',
	visibility: 'public',
	created: '2026-09-01T00:00:00Z',
	updated: '2026-09-01T00:00:00Z',
	data: {
		dashboardName: 'Chains',
		items: [],
		variables: [{ id: 'chain', kind: 'chain', label: 'Chain', value: 'Ethereum' }]
	}
}

let variables: ReturnType<typeof useProDashboardVariables>
function ChainValue() {
	variables = useProDashboardVariables()
	return <p>{variables.values.chain}</p>
}
const page = () => (
	<session.Wrapper>
		<ProDashboardAPIProvider mode="view" initialDashboardId="chains" initialDashboard={dashboard}>
			<ChainValue />
		</ProDashboardAPIProvider>
	</session.Wrapper>
)

let root: Root | undefined
let container: HTMLDivElement
beforeEach(() => {
	router.replace.mockClear()
	session.serve({
		'/api/dynamic/pro-dashboard/chains/stream': () =>
			new Response(`${JSON.stringify({ type: 'dashboard', data: dashboard })}\n{"type":"done"}\n`),
		[`${FEATURES_SERVER}/lite/dashboards`]: { items: [] },
		[`${FEATURES_SERVER}/dashboards`]: { items: [] }
	})
	container = document.createElement('div')
	document.body.append(container)
})
afterEach(async () => {
	await act(async () => root?.unmount())
	root = undefined
	container.remove()
})

test('a link carrying a parameter value draws it from the server render on, with no default first', async () => {
	router.query = { dashboardId: 'chains', 'var-chain': 'Solana' }
	const hydrated = await renderHydrated(page(), { pageClockSec: 1_790_000_000 })
	root = hydrated.root
	expect(hydrated.serverHtml).toContain('<p>Solana</p>')
	expect(hydrated.errors).toEqual([])
	expect(hydrated.container.textContent).toBe('Solana')
})

test('a picked value round-trips through the link, survives a tab switch, and back restores the saved value', async () => {
	router.query = { dashboardId: 'chains' }
	root = createRoot(container)
	const render = () => act(async () => root!.render(page()))
	await render()
	expect(container.textContent).toBe('Ethereum')

	await act(async () => variables.setVariableValue('chain', 'Solana'))
	expect(router.replace).toHaveBeenCalledExactlyOnceWith(
		{ pathname: '/pro/[dashboardId]/[[...mode]]', query: { dashboardId: 'chains', 'var-chain': 'Solana' } },
		undefined,
		{ shallow: true, scroll: false }
	)
	await render()
	expect(container.textContent).toBe('Solana')

	// Another query write leaves the overrides, and every card resolved from them, as they were.
	const overrides = variables.overrides
	router.query = { ...router.query, tab: 'second' }
	await render()
	expect(variables.overrides).toBe(overrides)

	router.query = { dashboardId: 'chains' }
	await render()
	expect(container.textContent).toBe('Ethereum')
})
