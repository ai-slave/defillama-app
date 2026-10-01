// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ClaimTokenProfile } from '../ClaimTokenProfile'
import type { UtrClaimProjectOption } from '../types'

const router = vi.hoisted(() => ({ isReady: false, query: {} as Record<string, string> }))
vi.mock('next/router', () => ({ useRouter: () => router }))

const project = (arcticId: string, projectName: string, symbol: string): UtrClaimProjectOption => ({
	arcticId,
	projectName,
	symbol,
	coingeckoId: null,
	tgeStatus: 'post',
	disclosureScore: null,
	gradedCount: 0,
	criteriaCount: 13
})
const PROJECTS = [project('a', 'Aave', 'AAVE'), project('b', 'Ethena', 'ENA'), project('c', 'Uniswap', 'UNI')]

let container: HTMLDivElement
let root: Root
let client: QueryClient

const render = () =>
	act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<ClaimTokenProfile projects={PROJECTS} exchangeOptions={[]} marketMakerOptions={[]} />
			</QueryClientProvider>
		)
	)
const tokenSelect = () => container.querySelector<HTMLSelectElement>('select[aria-label="Token to claim"]')!

beforeEach(() => {
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	client.clear()
	router.isReady = false
	router.query = {}
})

test('a claim link preselects its token after hydration, and a token the reader picks sticks', async () => {
	// A static page's query is empty until hydration, so the first render shows the first project.
	await render()
	expect(tokenSelect().value).toBe('a')

	router.isReady = true
	router.query = { token: 'ena' }
	await render()
	expect(tokenSelect().value).toBe('b')

	await act(async () => {
		tokenSelect().value = 'c'
		tokenSelect().dispatchEvent(new Event('change', { bubbles: true }))
	})
	await render()
	expect(tokenSelect().value).toBe('c')
})
