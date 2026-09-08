// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import toast from 'react-hot-toast'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Dashboard } from '../dashboardTypes'
import { GenerateDashboardModal } from './GenerateDashboardModal'
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), push: vi.fn() }))
vi.mock('~/auth', () => ({
	useAuthContext: () => ({ isAuthenticated: true, user: { id: 'owner' }, authorizedFetch: mocks.fetch })
}))
vi.mock('next/router', () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }))
let root: Root
let container: HTMLDivElement
let client: QueryClient
const save = vi.fn()
const close = vi.fn()
const dashboard: Dashboard = { id: 'new', data: { items: [], dashboardName: 'My analysis' }, created: '', updated: '' }
async function render(open = true, mode: 'create' | 'iterate' = 'create') {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<GenerateDashboardModal
					isOpen={open}
					onClose={close}
					onGenerate={save}
					mode={mode}
					existingDashboard={{
						dashboardName: 'Existing dashboard',
						visibility: 'private',
						tags: ['research'],
						description: 'Saved description',
						items: []
					}}
				/>
			</QueryClientProvider>
		)
	)
}
async function submit() {
	await act(async () => document.querySelector<HTMLButtonElement>('button[type="submit"]')!.click())
}
function draft() {
	document.querySelector<HTMLInputElement>('[name="dashboardName"]')!.value = 'My analysis'
	document.querySelector<HTMLTextAreaElement>('[name="aiDescription"]')!.value =
		'Compare the fees and TVL of Ethereum and Arbitrum'
}
beforeEach(() => {
	vi.clearAllMocks()
	save.mockReset()
	mocks.fetch.mockImplementation(
		async () => new Response('data: {"type":"dashboard_complete","dashboardConfig":{"items":[]}}\n\n')
	)
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
test('generation waits for persistence, retains a failed draft, and navigates only after a successful retry', async () => {
	const pending = Promise.withResolvers<Dashboard>()
	save.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(dashboard)
	await render()
	draft()
	await submit()
	await vi.waitFor(() => expect(save).toHaveBeenCalledOnce())
	expect(close).not.toHaveBeenCalled()
	expect(mocks.push).not.toHaveBeenCalled()
	expect(document.querySelector('button[type="submit"]')!.getAttribute('aria-disabled')).toBe('true')
	await submit()
	expect(mocks.fetch).toHaveBeenCalledOnce()
	await act(async () => pending.reject(new Error('Save unavailable')))
	await vi.waitFor(() => expect(document.querySelector('[role="alert"]')?.textContent).toContain('Save unavailable'))
	expect(toast.error).not.toHaveBeenCalled()
	expect(document.querySelector<HTMLInputElement>('[name="dashboardName"]')!.value).toBe('My analysis')
	await submit()
	await vi.waitFor(() => expect(close).toHaveBeenCalledOnce())
	expect(mocks.push).toHaveBeenCalledExactlyOnceWith('/pro/new')
})
test.each(['success', 'failure'] as const)(
	'a generation finishing with %s after unmount cannot affect another opening',
	async (outcome) => {
		const pending = Promise.withResolvers<Dashboard>()
		save.mockReturnValueOnce(pending.promise)
		await render()
		draft()
		await submit()
		await vi.waitFor(() => expect(save).toHaveBeenCalledOnce())
		await render(false)
		await render()
		await act(async () => {
			if (outcome === 'success') pending.resolve(dashboard)
			else pending.reject(new Error('Earlier generation failed'))
		})
		await vi.waitFor(() => expect(client.isMutating()).toBe(0))
		expect(close).not.toHaveBeenCalled()
		expect(mocks.push).not.toHaveBeenCalled()
		expect(document.querySelector('[role="alert"]')).toBeNull()
		expect(vi.mocked(toast.error).mock.calls).toEqual(outcome === 'failure' ? [['Earlier generation failed']] : [])
	}
)
test('a stream error is shown inline without attempting to save', async () => {
	mocks.fetch.mockResolvedValueOnce(new Response('data: {"type":"error","message":"Generation unavailable"}\n\n'))
	await render()
	draft()
	await submit()
	await vi.waitFor(() =>
		expect(document.querySelector('[role="alert"]')?.textContent).toContain('Generation unavailable')
	)
	expect(save).not.toHaveBeenCalled()
	expect(close).not.toHaveBeenCalled()
	expect(toast.error).not.toHaveBeenCalled()
})

test('iteration preserves existing metadata, awaits saving, and closes without creation navigation', async () => {
	const pending = Promise.withResolvers<void>()
	save.mockReturnValueOnce(pending.promise)
	await render(true, 'iterate')
	document.querySelector<HTMLTextAreaElement>('[name="aiDescription"]')!.value =
		'Add a fees comparison to this dashboard'
	await submit()
	await vi.waitFor(() => expect(save).toHaveBeenCalledOnce())
	expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).toEqual({
		message: 'Add a fees comparison to this dashboard',
		mode: 'iterate',
		existingDashboard: { dashboardName: 'Existing dashboard', items: [] }
	})
	expect(save).toHaveBeenCalledExactlyOnceWith({
		dashboardName: 'Existing dashboard',
		visibility: 'private',
		tags: ['research'],
		description: 'Saved description',
		items: []
	})
	expect(close).not.toHaveBeenCalled()
	await act(async () => pending.resolve())
	await vi.waitFor(() => expect(close).toHaveBeenCalledOnce())
	expect(mocks.push).not.toHaveBeenCalled()
})
