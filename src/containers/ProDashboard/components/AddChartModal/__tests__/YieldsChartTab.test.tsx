// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'
import { YieldsChartTab } from '../YieldsChartTab'

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/pro/test', query: {}, push: vi.fn() }) }))

const http = installFixtureFetch()
let root: Root
let container: HTMLDivElement
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	// The pool list and the pool's history are still loading, as on the first open of a saved card.
	const pending = () => new Promise<Response>(() => {})
	http.serve({ 'https://': pending, 'http://': pending, '/': pending })
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

async function renderTab(onChartTypeChange = vi.fn()) {
	await act(async () =>
		root.render(
			<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } })}>
				<YieldsChartTab
					selectedYieldPool={{ configID: 'pool-1', name: 'USDC', project: 'aave-v3', chain: 'Ethereum' }}
					onSelectedYieldPoolChange={vi.fn()}
					selectedYieldChartType="borrow-apy"
					onSelectedYieldChartTypeChange={onChartTypeChange}
					selectedYieldChains={[]}
					selectedYieldProjects={[]}
					selectedYieldCategories={[]}
					selectedYieldTokens={[]}
					minTvl={null}
					maxTvl={null}
					onSelectedYieldChainsChange={vi.fn()}
					onSelectedYieldProjectsChange={vi.fn()}
					onSelectedYieldCategoriesChange={vi.fn()}
					onSelectedYieldTokensChange={vi.fn()}
					onMinTvlChange={vi.fn()}
					onMaxTvlChange={vi.fn()}
				/>
			</QueryClientProvider>
		)
	)
	await act(async () => new Promise((resolve) => setTimeout(resolve, 20)))
}

test('editing a borrow-cost card keeps its chart type while the pool data loads', async () => {
	const onChartTypeChange = vi.fn()
	await renderTab(onChartTypeChange)
	expect(onChartTypeChange).not.toHaveBeenCalled()
})

test('a pool list that fails to load says so instead of showing no pools', async () => {
	const failed = () => new Response(null, { status: 503 })
	http.serve({ 'https://': failed, 'http://': failed, '/': failed })
	await renderTab()
	await waitForUi(() => expect(container.textContent).toContain("Couldn't load the yield pools."))
	expect(container.textContent).not.toMatch(/\d+ pools?/)
})
