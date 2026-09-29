// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '~/auth'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { ProtocolOverviewLayout } from '../Layout'
import type { IProtocolPageMetrics } from '../types'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/router', () => ({
	useRouter: () => ({
		pathname: '/protocol/[...protocol]',
		asPath: '/protocol/spark',
		query: {},
		events: { on() {}, off() {} },
		push,
		replace() {},
		prefetch: async () => {}
	})
}))
const http = installFixtureFetch()
let root: Root
let container: HTMLDivElement
let client: QueryClient
const metrics: IProtocolPageMetrics = {
	tvl: true,
	dexs: false,
	dexsNotionalVolume: false,
	perps: false,
	openInterest: false,
	optionsPremiumVolume: false,
	optionsNotionalVolume: false,
	optionsOpenInterest: false,
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
	inflows: false,
	activeUsers: false,
	newUsers: false,
	txCount: false,
	gasUsed: false,
	liquidationVolume: false,
	collateralLiquidated: false,
	borrowed: false,
	tokenRights: false,
	rwa: false
}

beforeEach(() => {
	http.serve({ '/searchlist.json': [] })
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	push.mockReset()
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	client.clear()
	container.remove()
})
async function render(name: string, pageMetrics = metrics) {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<AuthProvider>
					<ProtocolOverviewLayout name={name} category="Lending" metrics={pageMetrics} tab="information">
						<div>Protocol overview</div>
					</ProtocolOverviewLayout>
				</AuthProvider>
			</QueryClientProvider>
		)
	)
}
function button(label: string) {
	const element = [...container.querySelectorAll('button')].find((node) => node.textContent === label)
	expect(element, `Navigation control: ${label}`).toBeDefined()
	return element!
}
test.each([
	{ name: 'Spark', slug: 'spark' },
	{ name: 'Odyssey Finance', slug: 'odyssey-finance' }
])('opens the Enterprise dashboard for signed-out visitors to $name', async ({ name, slug }) => {
	await render(name)
	await act(async () => button('Enterprise').click())
	expect(push).toHaveBeenCalledWith(`/protocol/investor-relations/${slug}`)
	expect(container.querySelector('a[href="https://investors.defillama.com/spark"]')).toBeNull()
	expect(container.querySelector('a[href="https://enterprise.defillama.com/odyssey-ecosystem"]')).toBeNull()
})
test('opens Token Rights and TVL while ignoring a retired governance flag', async () => {
	const cachedMetrics = { ...metrics, tokenRights: true, governance: true }
	await render('Aave', cachedMetrics)
	await act(async () => button('Token Rights').click())
	expect(push).toHaveBeenLastCalledWith('/protocol/token-rights/aave')
	await act(async () => button('TVL').click())
	expect(push).toHaveBeenLastCalledWith('/protocol/tvl/aave')
	expect(container.textContent).not.toContain('Governance')
})
