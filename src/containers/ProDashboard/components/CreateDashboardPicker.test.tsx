// @vitest-environment happy-dom
import * as Ariakit from '@ariakit/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import toast from 'react-hot-toast'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { CreateDashboardPicker } from './CreateDashboardPicker'
const navigation = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/router', () => ({ useRouter: () => navigation }))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }))
vi.mock('~/auth', () => ({ useAuthContext: () => ({ hasActiveSubscription: true }) }))
vi.mock('~/containers/Chains/api', () => ({ fetchChainsByCategory: async () => ({ chainsUnique: [] }) }))
vi.mock('../AppMetadataContext', () => ({ useAppMetadata: () => ({ protocolsBySlug: new Map() }) }))
vi.mock('../ProDashboardAPIContext', () => ({ useProDashboardCatalog: () => ({ protocols: [], chains: [] }) }))
vi.mock('../hooks/useDimensionProtocols', () => ({ useDimensionProtocols: () => ({ dimensionProtocols: {} }) }))
let root: Root
let container: HTMLDivElement
let client: QueryClient
let store: Ariakit.DialogStore
const create = vi.fn()
beforeEach(() => {
	vi.clearAllMocks()
	create.mockReset()
	client = new QueryClient()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	client.clear()
	container.remove()
})
async function mount() {
	function Harness() {
		store = Ariakit.useDialogStore({ defaultOpen: true })
		return <CreateDashboardPicker dialogStore={store} onCreate={create} />
	}
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<Harness />
			</QueryClientProvider>
		)
	)
	await click('From Scratch')
}
async function click(name: string) {
	await act(async () => {
		;[...document.querySelectorAll<HTMLButtonElement>('button')]
			.find((button) => button.textContent?.trim().startsWith(name))!
			.click()
		await new Promise((resolve) => setTimeout(resolve, 0))
	})
}
async function waitFor(check: () => void) {
	await vi.waitFor(async () => {
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0))
		})
		check()
	})
}
test('failed creation retains the name and visibility, blocks duplicate submissions, and retries successfully', async () => {
	let reject!: (error: Error) => void
	create
		.mockImplementationOnce(
			() =>
				new Promise((_, fail) => {
					reject = fail
				})
		)
		.mockResolvedValueOnce({ id: 'created', slug: 'new-dashboard' })
	await mount()
	const name = document.querySelector<HTMLInputElement>('[name="dashboardName"]')!
	name.value = 'Keep my draft'
	await act(async () => document.querySelector<HTMLInputElement>('input[value="private"]')!.click())
	await click('Create Dashboard')
	expect(document.querySelector('fieldset')!.disabled).toBe(true)
	await click('Create Dashboard')
	expect(create).toHaveBeenCalledExactlyOnceWith({
		dashboardName: 'Keep my draft',
		visibility: 'private',
		tags: [],
		description: ''
	})
	await act(async () => {
		reject(new Error('Unavailable'))
		await new Promise((resolve) => setTimeout(resolve, 0))
	})
	await waitFor(() => expect(document.querySelector('[role="alert"]')).not.toBeNull())
	expect(name.value).toBe('Keep my draft')
	expect(document.querySelector<HTMLInputElement>('input[value="private"]')!.checked).toBe(true)
	await click('Create Dashboard')
	await waitFor(() => expect(create).toHaveBeenCalledTimes(2))
	await waitFor(() => expect(store.getState().open).toBe(false))
	expect(navigation.push).toHaveBeenCalledExactlyOnceWith('/pro/new-dashboard')
	expect(toast.error).not.toHaveBeenCalled()
})
test('a creation finishing after dismissal does not close a newly opened picker', async () => {
	let finish!: () => void
	create.mockImplementationOnce(
		() =>
			new Promise<{ id: string }>((resolve) => {
				finish = () => resolve({ id: 'older' })
			})
	)
	await mount()
	document.querySelector<HTMLInputElement>('[name="dashboardName"]')!.value = 'Earlier draft'
	await click('Create Dashboard')
	await waitFor(() => expect(create).toHaveBeenCalledOnce())
	await act(async () => store.hide())
	await act(async () => store.show())
	await act(async () => {
		finish()
		await new Promise((resolve) => setTimeout(resolve, 0))
	})
	expect(store.getState().open).toBe(true)
	expect(document.querySelector('[role="alert"]')).toBeNull()
	expect(navigation.push).not.toHaveBeenCalled()
})

test('a refusal shows why it was refused, not an invitation to retry', async () => {
	const limit = 'You have reached the free tier dashboard limit. Upgrade to Pro for unlimited dashboards.'
	create.mockRejectedValueOnce(new Error(limit))
	await mount()
	document.querySelector<HTMLInputElement>('[name="dashboardName"]')!.value = 'Over the limit'
	await click('Create Dashboard')
	await waitFor(() => expect(document.querySelector('[role="alert"]')).not.toBeNull())
	const alert = document.querySelector('[role="alert"]')!
	expect(alert.textContent).toContain(limit)
	expect(alert.textContent).not.toContain('please try again')
	expect(store.getState().open).toBe(true)
})
