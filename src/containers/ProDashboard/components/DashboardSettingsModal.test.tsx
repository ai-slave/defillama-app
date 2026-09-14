// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { DashboardSettingsModal } from './DashboardSettingsModal'

const auth = vi.hoisted(() => ({ hasActiveSubscription: true }))
vi.mock('~/auth', () => ({ useAuthContext: () => auth }))
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }))

let root: Root
let container: HTMLDivElement
let client: QueryClient
const save = vi.fn(async () => {})
const close = vi.fn()
const remove = vi.fn(async () => {})

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	auth.hasActiveSubscription = true
	vi.clearAllMocks()
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

async function renderSettings(tags: Array<string> = []) {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<DashboardSettingsModal
					isOpen
					onClose={close}
					dashboardName="Original"
					visibility="public"
					tags={tags}
					dashboardId="dashboard-1"
					onSave={save}
					onDelete={remove}
				/>
			</QueryClientProvider>
		)
	)
}

function button(label: string) {
	return Array.from(document.body.querySelectorAll('button')).find((node) => node.textContent?.trim() === label)
}

async function submit() {
	await act(async () =>
		document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
	)
}

test('the form keeps visibility and tags and no longer carries the name or description', async () => {
	await renderSettings()
	expect(document.querySelector('[name="dashboardName"]')).toBeNull()
	expect(document.querySelector('[name="description"]')).toBeNull()
	const tagInput = document.querySelector<HTMLInputElement>('#dashboard-settings-tag-input')!
	tagInput.value = 'Lending'
	await act(async () => button('Add Tag')!.click())
	await act(async () => document.querySelector<HTMLInputElement>('input[type="radio"][value="private"]')!.click())
	await submit()
	expect(save).toHaveBeenCalledExactlyOnceWith({ visibility: 'private', tags: ['lending'] })
	await vi.waitFor(() => expect(close).toHaveBeenCalledOnce())
	const toast = (await import('react-hot-toast')).default
	expect(toast.success).toHaveBeenCalledWith(
		'Settings saved',
		expect.objectContaining({ id: 'dashboard-settings-saved' })
	)
})

test('a removed tag leaves the draft before the save is sent', async () => {
	await renderSettings(['lending'])
	await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Remove tag lending"]')!.click())
	await submit()
	expect(save).toHaveBeenCalledExactlyOnceWith({ visibility: 'public', tags: [] })
})

test('deletion runs through the confirmation dialog and reports a failure there', async () => {
	remove.mockRejectedValueOnce(new Error('Offline'))
	await renderSettings()
	await act(async () => button('Delete Dashboard')!.click())
	expect(document.body.textContent).toContain('Are you sure you want to delete')
	await act(async () => button('Delete')!.click())
	await vi.waitFor(() =>
		expect(document.body.querySelector('[role="alert"]')?.textContent).toContain('Could not delete')
	)
	expect(close).not.toHaveBeenCalled()
	await act(async () => button('Delete')!.click())
	await vi.waitFor(() => expect(close).toHaveBeenCalledOnce())
	expect(remove).toHaveBeenCalledTimes(2)
	expect(remove).toHaveBeenLastCalledWith('dashboard-1')
})
