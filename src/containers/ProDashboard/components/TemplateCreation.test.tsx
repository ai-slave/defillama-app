// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ProDashboardAPIProvider, useProDashboardUI } from '../ProDashboardAPIContext'
import { CreateDashboardPicker } from './CreateDashboardPicker'

const api = vi.hoisted(() => ({
	catalog: vi.fn(),
	category: vi.fn(),
	dimension: vi.fn(),
	create: vi.fn(),
	push: vi.fn()
}))
vi.mock('next/router', () => ({ useRouter: () => ({ push: api.push, query: {} }) }))
vi.mock('~/auth', () => ({
	useAuthContext: () => ({ isAuthenticated: false, hasActiveSubscription: true, loaders: { userLoading: false } })
}))
vi.mock('~/utils/pocketbase', () => ({ default: { authStore: { isValid: false } } }))
vi.mock('../hooks/useDashboardStream', () => ({
	useDashboardStream: () => ({
		isDone: true,
		isStreaming: false,
		readyItemIds: new Set<string>(),
		dashboard: null,
		error: null
	})
}))
vi.mock('~/containers/Chains/api', () => ({
	fetchChainsList: async () => [
		{ name: 'Base', tvl: 300 },
		{ name: 'Ethereum', tvl: 200 }
	],
	fetchChainsByCategory: api.category
}))
vi.mock('~/containers/ProtocolLists/api', () => ({
	fetchProtocols: async () => ({ protocols: [], parentProtocols: [] })
}))
vi.mock('~/utils/async', async (original) => ({
	...(await original<typeof import('~/utils/async')>()),
	fetchJson: (url: string) => (url.endsWith('protocol-catalog-source') ? api.catalog() : api.dimension(url))
}))

const catalog = [
	{ slug: 'aave', parentSlug: 'aave', name: 'Aave', tvl: 100, category: 'Lending' },
	{ slug: 'spark', parentSlug: 'spark', name: 'Spark', tvl: 50, category: 'Lending' },
	{ slug: 'dex-by-tvl', parentSlug: 'dex-by-tvl', name: 'DEX by TVL', tvl: 500, category: 'Dexes' }
]
let root: Root
let container: HTMLDivElement
let client: QueryClient
function Harness() {
	const { createDashboardDialogStore } = useProDashboardUI()
	return (
		<>
			<button type="button" onClick={() => createDashboardDialogStore.show()}>
				Create new dashboard
			</button>
			<CreateDashboardPicker dialogStore={createDashboardDialogStore} onCreate={api.create} />
		</>
	)
}
async function mount() {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<ProDashboardAPIProvider mode="view">
					<Harness />
				</ProDashboardAPIProvider>
			</QueryClientProvider>
		)
	)
}
function button(name: string) {
	return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
		(el) => el.getAttribute('aria-label') === name || el.textContent?.trim().startsWith(name)
	)!
}
async function click(name: string) {
	await act(async () => button(name).click())
}
async function ready(name: string) {
	await act(async () => {
		await vi.waitFor(() => {
			expect(button(name).getAttribute('aria-label')).toBe(name)
			expect(button(name).getAttribute('aria-disabled')).not.toBe('true')
		})
	})
}
function savedFilters() {
	return api.create.mock.calls.at(-1)![0].items.find((item: { kind: string }) => item.kind === 'unified-table').filters
}
beforeEach(() => {
	vi.clearAllMocks()
	api.push.mockReset().mockResolvedValue(true)
	api.catalog.mockReset().mockResolvedValue(catalog)
	api.category.mockReset().mockResolvedValue({ chainsUnique: ['Base'] })
	api.dimension.mockReset().mockResolvedValue({ protocols: [{ slug: 'volume-leader', name: 'Volume Leader' }] })
	api.create.mockReset().mockResolvedValue({ id: 'created', slug: 'template-created' })
	client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } })
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	client.clear()
	container.remove()
})

test('cold catalog blocks Lending while From Scratch remains immediately usable', async () => {
	const response = Promise.withResolvers<typeof catalog>()
	api.catalog.mockReturnValue(response.promise)
	await mount()
	expect(api.catalog).not.toHaveBeenCalled()
	expect(api.dimension).not.toHaveBeenCalled()
	expect(api.category).not.toHaveBeenCalled()
	await click('Create new dashboard')
	await click('Lending Protocols')
	expect(api.create).not.toHaveBeenCalled()
	expect(button('Lending Protocols').getAttribute('aria-disabled')).toBe('true')
	await click('From Scratch')
	document.querySelector<HTMLInputElement>('[name="dashboardName"]')!.value = 'Blank by choice'
	await click('Create Dashboard')
	expect(api.create).toHaveBeenCalledExactlyOnceWith({
		dashboardName: 'Blank by choice',
		visibility: 'private',
		tags: [],
		description: ''
	})
	await click('Create new dashboard')
	await act(async () => response.resolve(catalog))
	await ready('Lending Protocols')
	await click('Lending Protocols')
	expect(savedFilters()).toEqual({ protocols: ['aave', 'spark'] })
})

test.each([
	['Top L1 Chains', ['Ethereum']],
	['L2 Ecosystem', ['Base']]
] as const)('%s waits for category membership before selecting chains', async (name, chains) => {
	const response = Promise.withResolvers<{ chainsUnique: Array<string> }>()
	api.category.mockReturnValue(response.promise)
	await mount()
	await click('Create new dashboard')
	await ready('Lending Protocols')
	await click(name)
	expect(api.create).not.toHaveBeenCalled()
	await act(async () => response.resolve({ chainsUnique: ['Base'] }))
	await ready(name)
	await click(name)
	expect(savedFilters()).toEqual({ chains })
})

test.each([
	['DEX Leaders', 'dexs'],
	['Perps Protocols', 'perps'],
	['DEX Aggregators', 'dex-aggregators']
])('%s waits for its dimension and can load independently of the catalog', async (name, endpoint) => {
	const response = Promise.withResolvers<{ protocols: Array<{ slug: string; name: string }> }>()
	api.catalog.mockReturnValue(new Promise(() => {}))
	api.dimension.mockImplementation((url: string) =>
		url.endsWith(`/${endpoint}`)
			? response.promise
			: Promise.resolve({ protocols: [{ slug: 'other-dimension', name: 'Other dimension' }] })
	)
	await mount()
	await click('Create new dashboard')
	await click(name)
	expect(api.create).not.toHaveBeenCalled()
	await act(async () => response.resolve({ protocols: [{ slug: 'volume-leader', name: 'Volume Leader' }] }))
	await ready(name)
	await click(name)
	expect(savedFilters()).toEqual({ protocols: ['volume-leader'] })
})

test.each(['catalog', 'category', 'dimension'] as const)(
	'%s failure is retryable without creating a partial dashboard',
	async (source) => {
		api[source].mockRejectedValue(new Error('Unavailable'))
		await mount()
		await click('Create new dashboard')
		const name = source === 'catalog' ? 'Lending Protocols' : source === 'category' ? 'L2 Ecosystem' : 'DEX Leaders'
		await act(async () => {
			await vi.waitFor(() => expect(button(`Retry ${name}`)).toBeDefined())
		})
		const retry = button(`Retry ${name}`)
		await act(async () => retry.focus())
		const response = Promise.withResolvers<unknown>()
		api[source].mockReturnValue(response.promise)
		await click(`Retry ${name}`)
		await act(async () => {
			await vi.waitFor(() => expect(retry.getAttribute('aria-disabled')).toBe('true'))
		})
		expect(api.create).not.toHaveBeenCalled()
		if (source !== 'catalog') await ready('Lending Protocols')
		await act(async () =>
			response.resolve(
				source === 'catalog'
					? catalog
					: source === 'category'
						? { chainsUnique: ['Base'] }
						: { protocols: [{ slug: 'volume-leader', name: 'Volume Leader' }] }
			)
		)
		await ready(name)
		expect(document.activeElement).toBe(retry)
		await click(name)
		expect(savedFilters()).toEqual(
			source === 'catalog'
				? { protocols: ['aave', 'spark'] }
				: source === 'category'
					? { chains: ['Base'] }
					: { protocols: ['volume-leader'] }
		)
	}
)

test('empty dimension data cannot fall back to unrelated TVL data or create an empty dashboard', async () => {
	api.dimension.mockResolvedValue({ protocols: [] })
	await mount()
	await click('Create new dashboard')
	await ready('Lending Protocols')
	await act(async () => {
		await vi.waitFor(() => expect(button('DEX Leaders').textContent).toContain('No matching data available'))
	})
	await click('DEX Leaders')
	expect(api.create).not.toHaveBeenCalled()
})

test('closing and reopening while data loads never submits automatically or navigates', async () => {
	const response = Promise.withResolvers<typeof catalog>()
	api.catalog.mockReturnValue(response.promise)
	await mount()
	await click('Create new dashboard')
	await click('Lending Protocols')
	await click('Close dialog')
	await act(async () => response.resolve(catalog))
	expect(api.create).not.toHaveBeenCalled()
	expect(api.push).not.toHaveBeenCalled()
	await click('Create new dashboard')
	await ready('Lending Protocols')
	await click('Lending Protocols')
	expect(api.create).toHaveBeenCalledOnce()
	expect(savedFilters()).toEqual({ protocols: ['aave', 'spark'] })
})

test('pending template creation keeps focus and ignores duplicate activation, then retries the same selection', async () => {
	const completion = Promise.withResolvers<{ id: string }>()
	api.create.mockReturnValueOnce(completion.promise).mockResolvedValueOnce({ id: 'created' })
	await mount()
	await click('Create new dashboard')
	await ready('Lending Protocols')
	const choice = button('Lending Protocols')
	await act(async () => choice.focus())
	await click('Lending Protocols')
	await act(async () => {
		await vi.waitFor(() => expect(choice.getAttribute('aria-disabled')).toBe('true'))
	})
	expect(document.activeElement).toBe(choice)
	expect(choice.querySelector('[role="status"]')?.textContent).toBe('Creating dashboard…')
	expect(button('Liquid Staking').getAttribute('aria-busy')).toBe('false')
	await click('Lending Protocols')
	expect(api.create).toHaveBeenCalledOnce()
	await act(async () => completion.reject(new Error('Save unavailable')))
	await ready('Lending Protocols')
	expect(document.querySelector('[role="alert"]')?.textContent).toContain('Save unavailable')
	expect(document.activeElement).toBe(choice)
	await click('Lending Protocols')
	expect(api.create).toHaveBeenCalledTimes(2)
	expect(savedFilters()).toEqual({ protocols: ['aave', 'spark'] })
})

test('keeps the selected template busy until navigation finishes without creating another dashboard', async () => {
	const navigation = Promise.withResolvers<boolean>()
	api.push.mockReturnValueOnce(navigation.promise)
	await mount()
	await click('Create new dashboard')
	await ready('Lending Protocols')
	await click('Lending Protocols')
	await act(async () => {
		await vi.waitFor(() =>
			expect(document.querySelector('a[href="/pro/template-created/edit"]')?.textContent).toBe('Open dashboard')
		)
	})
	expect(button('Lending Protocols').getAttribute('aria-disabled')).toBe('true')
	expect(document.querySelector('a[href="/pro/template-created/edit"]')?.textContent).toBe('Open dashboard')
	await click('Lending Protocols')
	expect(api.create).toHaveBeenCalledOnce()
	await act(async () => navigation.resolve(true))
	await act(async () => {
		await vi.waitFor(() => expect(button('Lending Protocols')).toBeUndefined())
	})
})
