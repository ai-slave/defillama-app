// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import toast from 'react-hot-toast'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { useDashboardAPI } from '../../hooks/useDashboardAPI'
import { DashboardSettingsModal } from '../DashboardSettingsModal'

vi.mock('next/router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('react-hot-toast', () => {
	const mock = Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), dismiss: vi.fn() })
	return { default: mock, toast: mock }
})
const session = installSubscriberSession('owner')
const SAVE_PATH = '/api/private/pro-dashboard/save'
const saved = {
	id: 'dashboard',
	data: { items: [], dashboardName: 'Original' },
	created: '2026-09-01',
	updated: '2026-09-01'
}
const savedTags = () =>
	session.requests
		.filter((request) => request.url.pathname === SAVE_PATH)
		.map((request) => JSON.parse(request.init!.body as string).tags)
let root: Root
let container: HTMLDivElement
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
			<session.Wrapper>
				<Harness open={open} />
			</session.Wrapper>
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
	session.serve({ '/dashboards': { items: [] } })
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})
test('a real API failure appears once in the open settings form and retry saves the retained draft', async () => {
	let attempts = 0
	session.serve({
		[SAVE_PATH]: () => (++attempts === 1 ? Response.json({ error: 'Offline' }, { status: 500 }) : saved)
	})
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
	expect(savedTags()).toEqual([['lending'], ['lending']])
})
test.each(['success', 'failure'] as const)(
	'an old opening finishing with %s cannot affect a reopened form',
	async (outcome) => {
		const pending = Promise.withResolvers<Response>()
		session.serve({ [SAVE_PATH]: () => pending.promise })
		await render(true)
		const originalInput = tagInput()
		originalInput.focus()
		await submit()
		// The pending state reaches React on a TanStack notify tick, after the save request starts.
		await vi.waitFor(() => {
			expect(savedTags()).toEqual([[]])
			expect(originalInput.readOnly).toBe(true)
		})
		expect(document.activeElement).toBe(originalInput)
		await render(false)
		await render(true)
		const draft = tagInput()
		draft.value = 'New opening'
		await act(async () => {
			if (outcome === 'success') pending.resolve(Response.json(saved))
			else pending.resolve(Response.json({ error: 'Earlier save failed' }, { status: 500 }))
		})
		await vi.waitFor(() => expect(session.client.isMutating()).toBe(0))
		expect(close).not.toHaveBeenCalled()
		expect(draft.value).toBe('New opening')
		expect(document.querySelector('[role="alert"]')).toBeNull()
		expect(vi.mocked(toast.error).mock.calls).toEqual(outcome === 'failure' ? [['Earlier save failed']] : [])
	}
)
