// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import toast from 'react-hot-toast'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useDashboardAPI } from '../hooks/useDashboardAPI'
import { DashboardSettingsModal } from './DashboardSettingsModal'

const api = vi.hoisted(() => ({ update: vi.fn() }))
vi.mock('~/auth', () => ({
	useAuthContext: () => ({
		isAuthenticated: true,
		user: { id: 'owner' },
		hasActiveSubscription: true,
		authorizedFetch: vi.fn()
	})
}))
vi.mock('next/router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('react-hot-toast', () => {
	const mock = Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), dismiss: vi.fn() })
	return { default: mock, toast: mock }
})
vi.mock('../services/DashboardAPI', async (original) => ({
	...(await original<typeof import('../services/DashboardAPI')>()),
	dashboardAPI: { listDashboards: async () => [], updateDashboard: api.update }
}))
let root: Root
let container: HTMLDivElement
let client: QueryClient
const close = vi.fn()
function Harness({ open }: { open: boolean }) {
	const { updateDashboard } = useDashboardAPI('dashboard')
	return (
		<DashboardSettingsModal
			isOpen={open}
			onClose={close}
			dashboardId="dashboard"
			dashboardName="Original"
			visibility="public"
			tags={[]}
			onSave={async (overrides) => {
				await updateDashboard.mutateAsync({
					id: 'dashboard',
					data: { items: [], dashboardName: 'Original', ...overrides }
				})
			}}
		/>
	)
}
async function render(open: boolean) {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<Harness open={open} />
			</QueryClientProvider>
		)
	)
}
async function submit() {
	await act(async () => document.querySelector<HTMLButtonElement>('button[type="submit"]')!.click())
}
function tagInput() {
	return document.querySelector<HTMLInputElement>('#dashboard-settings-tag-input')!
}
async function addTag(tag: string) {
	tagInput().value = tag
	await act(async () =>
		Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
			.find((node) => node.textContent?.trim() === 'Add Tag')!
			.click()
	)
}
beforeEach(() => {
	vi.clearAllMocks()
	api.update.mockReset()
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
test('a real API failure appears once in the open settings form and retry saves the retained draft', async () => {
	api.update.mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({ id: 'dashboard' })
	await render(true)
	await addTag('lending')
	await submit()
	await vi.waitFor(() =>
		expect(document.querySelector('[role="alert"]')?.textContent).toContain('Could not save changes')
	)
	expect(toast.error).not.toHaveBeenCalled()
	expect(close).not.toHaveBeenCalled()
	await submit()
	await vi.waitFor(() => expect(close).toHaveBeenCalledOnce())
	expect(api.update.mock.calls.map(([, data]) => data.tags)).toEqual([['lending'], ['lending']])
})
test.each(['success', 'failure'] as const)(
	'an old opening finishing with %s cannot affect a reopened form',
	async (outcome) => {
		const pending = Promise.withResolvers<{ id: string }>()
		api.update.mockReturnValueOnce(pending.promise)
		await render(true)
		const originalInput = tagInput()
		originalInput.focus()
		await submit()
		// `readOnly` comes from the mutation's pending state, so waiting on the API mock alone races the
		// React commit that locks the form: the mock is called from inside the mutation function, which
		// runs before the pending render is flushed.
		await vi.waitFor(() => {
			expect(api.update).toHaveBeenCalledOnce()
			expect(originalInput.readOnly).toBe(true)
		})
		expect(document.activeElement).toBe(originalInput)
		await render(false)
		await render(true)
		const draft = tagInput()
		draft.value = 'New opening'
		await act(async () => {
			if (outcome === 'success') pending.resolve({ id: 'dashboard' })
			else pending.reject(new Error('Earlier save failed'))
		})
		await vi.waitFor(() => expect(client.isMutating()).toBe(0))
		expect(close).not.toHaveBeenCalled()
		expect(draft.value).toBe('New opening')
		expect(document.querySelector('[role="alert"]')).toBeNull()
		expect(vi.mocked(toast.error).mock.calls).toEqual(outcome === 'failure' ? [['Earlier save failed']] : [])
	}
)
