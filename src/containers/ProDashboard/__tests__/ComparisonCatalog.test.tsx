// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { SelectItemsStep } from '../components/ComparisonWizard/steps/SelectItemsStep'
import { ProDashboardAPIProvider, useProDashboardUI } from '../ProDashboardAPIContext'

const mocks = vi.hoisted(() => ({
	fetchChains: vi.fn(),
	fetchCategories: vi.fn(),
	fetchCategoryChains: vi.fn(),
	toggleItem: vi.fn(),
	comparisonType: 'chains' as 'chains' | 'protocols'
}))
vi.mock('~/auth', () => ({
	useAuthContext: () => ({ isAuthenticated: false, loaders: { userLoading: false } })
}))
vi.mock('~/utils/pocketbase', () => ({ default: { authStore: { isValid: false } } }))
vi.mock('../hooks/useDashboardStream', () => ({
	useDashboardStream: () => ({ isDone: true, dashboard: null, error: null })
}))
vi.mock('../hooks/useFreeTierStatus', () => ({
	useFreeTierStatus: () => ({ canCreateDashboard: true, isFreeUser: true })
}))
vi.mock('../hooks/useDashboardPermissions', () => ({
	useDashboardPermissions: () => ({ isReadOnly: true, dashboardOwnerId: null })
}))
vi.mock('../hooks/useAutoSave', () => ({ useAutoSave: () => ({}) }))
vi.mock('../hooks/useDashboardAPI', () => ({
	getUnsavedDashboardItems: () => null,
	wasDashboardDeleted: () => false,
	useDashboardAPI: () => ({ createDashboard: {}, updateDashboard: {} })
}))
vi.mock('~/containers/Chains/api', () => ({
	fetchChainsList: mocks.fetchChains,
	fetchChainsCategories: mocks.fetchCategories,
	fetchChainsByCategory: mocks.fetchCategoryChains
}))
vi.mock('~/containers/ProtocolLists/api', () => ({
	fetchProtocols: async () => ({ protocols: [], parentProtocols: [] })
}))
vi.mock('~/utils/async', async (importOriginal) => ({
	...(await importOriginal<typeof import('~/utils/async')>()),
	fetchJson: async () => [{ slug: 'aave', parentSlug: 'aave', name: 'Aave', tvl: 100 }]
}))
vi.mock('../components/ComparisonWizard/ComparisonWizardContext', () => ({
	useComparisonWizardContext: () => ({
		state: { comparisonType: mocks.comparisonType, selectedItems: [] },
		actions: { toggleSelectedItem: mocks.toggleItem }
	})
}))
// happy-dom has no layout measurements; expose the virtual rows for interaction checks.
vi.mock('@tanstack/react-virtual', () => ({
	useVirtualizer: ({ count }: { count: number }) => ({
		getTotalSize: () => count * 48,
		getVirtualItems: () => Array.from({ length: count }, (_, index) => ({ index, size: 48, start: index * 48 }))
	})
}))

let root: Root
let container: HTMLDivElement
let client: QueryClient

beforeEach(() => {
	vi.clearAllMocks()
	mocks.comparisonType = 'chains'
	mocks.fetchCategories.mockReset().mockResolvedValue({ categories: [] })
	mocks.fetchCategoryChains.mockReset()
	mocks.fetchChains.mockReset().mockResolvedValue([
		{ name: 'Base', tvl: 100 },
		{ name: 'Ethereum', tvl: 200 }
	])
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

function Harness() {
	const { createDashboardDialogStore } = useProDashboardUI()
	return (
		<>
			<button type="button" onClick={() => createDashboardDialogStore.show()}>
				Create comparison
			</button>
			<SelectItemsStep />
		</>
	)
}

async function mount() {
	await act(async () => {
		root.render(
			<QueryClientProvider client={client}>
				<ProDashboardAPIProvider>
					<Harness />
				</ProDashboardAPIProvider>
			</QueryClientProvider>
		)
	})
}

async function click(label: string) {
	const button = [...container.querySelectorAll('button')].find((button) => button.textContent?.trim() === label)
	expect(button, `button ${label}`).toBeDefined()
	await act(async () => button!.click())
}

async function waitForText(text: string) {
	await vi.waitFor(async () => {
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0))
		})
		expect(container.textContent).toContain(text)
	})
}

test.each(['chains', 'protocols'] as const)(
	'opening creation loads selectable %s from a cold view-mode catalog',
	async (type) => {
		mocks.comparisonType = type
		await mount()
		expect(mocks.fetchChains).not.toHaveBeenCalled()
		await click('Create comparison')
		const label = type === 'chains' ? 'Base' : 'Aave'
		await waitForText(label)
		expect(mocks.fetchChains).toHaveBeenCalledTimes(1)
		const search = container.querySelector<HTMLInputElement>('input[type="text"]')!
		await act(async () => {
			search.value = label
			search.dispatchEvent(new Event('input', { bubbles: true }))
		})
		await click(label)
		expect(mocks.toggleItem).toHaveBeenCalledWith(type === 'chains' ? 'Base' : 'aave', 10)
	}
)

test('a catalog failure shows an error and Retry recovers the chain list', async () => {
	mocks.fetchChains.mockRejectedValueOnce(new Error('Unavailable'))
	await mount()
	await click('Create comparison')
	await waitForText('Failed to load chains')
	expect(container.textContent).not.toContain('No chains found')
	await click('Retry')
	await waitForText('Base')
	expect(container.querySelector('[role="alert"]')).toBeNull()
	expect(mocks.fetchChains).toHaveBeenCalledTimes(2)
})

test('changing comparison type clears category filters and preserves search', async () => {
	mocks.fetchCategories.mockResolvedValue({ categories: ['Rollup'] })
	mocks.fetchCategoryChains.mockResolvedValue({ chainsUnique: ['Base'] })
	await mount()
	await click('Create comparison')
	await waitForText('Base')
	await click('All categories')
	const category = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
		(node) => node.textContent?.trim() === 'Rollup'
	)!
	await act(async () => category.click())
	const input = container.querySelector<HTMLInputElement>('input[type="text"]')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Base')
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
	mocks.comparisonType = 'protocols'
	await mount()
	expect(container.querySelector<HTMLInputElement>('input[type="text"]')!.value).toBe('Base')
	expect(container.textContent).toContain('All categories')
	mocks.comparisonType = 'chains'
	await mount()
	expect(container.textContent).toContain('All categories')
	expect(container.querySelector<HTMLInputElement>('input[type="text"]')!.value).toBe('Base')
})
