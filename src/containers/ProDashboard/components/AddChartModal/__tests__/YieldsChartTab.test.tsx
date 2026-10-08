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
					error={null}
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
}

const chartTypeRadios = () => [
	...container.querySelectorAll<HTMLInputElement>('[role="radiogroup"][aria-label="Chart type"] input[type="radio"]')
]

test('editing a borrow-cost card keeps its chart type while the pool data loads', async () => {
	// The pool list has the card's borrow market; the pool's supply and borrow history stay pending.
	http.serve({
		'/api/public/yields/earn': {
			rows: [
				{ configID: 'pool-1', pool: 'USDC', project: 'aave-v3', chains: ['Ethereum'], tvl: 1, tokenSymbols: ['USDC'] }
			]
		},
		'/api/public/yields/borrow-markets': { rows: [{ id: 'pool-1', borrowApy: 4, totalBorrowUsd: 1 }] }
	})
	const onChartTypeChange = vi.fn()
	await renderTab(onChartTypeChange)
	// Borrow types join the picker once their history loads; until then none of the offered types is selected.
	await waitForUi(() =>
		expect(chartTypeRadios().map((radio) => [radio.parentElement!.textContent, radio.checked])).toEqual([
			['TVL & Supply APY', false]
		])
	)
	expect(onChartTypeChange).not.toHaveBeenCalled()
})

test('a pool list that fails to load says so instead of showing no pools', async () => {
	const failed = () => new Response(null, { status: 503 })
	http.serve({ 'https://': failed, 'http://': failed, '/': failed })
	await renderTab()
	await waitForUi(() => expect(container.textContent).toContain("Couldn't load the yield pools."))
	expect(container.textContent).not.toMatch(/\d+ pools?/)
})

test('picking a chart type is a radio choice that reports the new type', async () => {
	// The pool list loads empty; the picked pool's history stays pending.
	http.serve({
		'/api/public/yields/earn': { rows: [] },
		'/api/public/yields/borrow-markets': { rows: [] }
	})
	const onChartTypeChange = vi.fn()
	await renderTab(onChartTypeChange)
	const radio = () =>
		[...container.querySelectorAll('[role="radiogroup"][aria-label="Chart type"] label')]
			.find((label) => label.textContent === 'TVL & Supply APY')
			?.querySelector<HTMLInputElement>('input[type="radio"]')
	// Chart types stay disabled until the pool list settles.
	await waitForUi(() => expect(radio()?.disabled).toBe(false))
	expect(radio()!.checked).toBe(false)
	await act(async () => radio()!.click())
	expect(onChartTypeChange).toHaveBeenCalledWith('tvl-apy')
})
