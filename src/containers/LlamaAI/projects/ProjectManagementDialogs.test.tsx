// @vitest-environment happy-dom
import * as Ariakit from '@ariakit/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { CreateProjectModal } from './CreateProjectModal'
import { DeleteProjectModal } from './DeleteProjectModal'
import { ProjectSessionItem } from './ProjectSessionItem'
import { ProjectsSidebarSection } from './ProjectsSidebarSection'
import type { Project } from './types'

const api = vi.hoisted(() => ({
	request: vi.fn(),
	created: vi.fn(),
	deleted: vi.fn(),
	success: vi.fn(),
	error: vi.fn(),
	push: vi.fn()
}))
vi.mock('~/auth', () => ({
	useAuthContext: () => ({
		user: { id: 'user' },
		authorizedFetch: vi.fn(),
		hasActiveSubscription: true,
		isAuthenticated: true
	})
}))
vi.mock('next/router', () => ({ useRouter: () => ({ push: api.push }) }))
vi.mock('~/containers/LlamaAI/chrome', () => ({ useLlamaAIChrome: () => ({ hideSidebar: vi.fn() }) }))
vi.mock('~/containers/LlamaAI/components/sidebar/AgenticSidebar', () => ({ SIDEBAR_ROW: '', SIDEBAR_ROW_SURFACE: '' }))
vi.mock('~/containers/LlamaAI/components/sidebar/AgenticSessionItem', () => ({ AgenticSessionItem: () => null }))
vi.mock('~/containers/LlamaAI/api/transport', () => ({ llamaAIRequest: api.request }))
vi.mock('react-hot-toast', () => ({ default: { success: api.success, error: api.error } }))
let root: Root
let container: HTMLDivElement
let client: QueryClient
const project: Project = {
	id: 'qa',
	user_id: 'user',
	name: 'QA Project',
	description: 'Original description',
	icon: null,
	color: null,
	custom_instructions: null,
	created_at: '2026-09-07',
	updated_at: '2026-09-07'
}
beforeEach(() => {
	vi.resetAllMocks()
	localStorage.clear()
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
async function mount(mode: 'create' | 'rename' | 'delete') {
	function Harness() {
		const store = Ariakit.useDialogStore()
		return (
			<>
				<Ariakit.DialogDisclosure store={store}>Open project dialog</Ariakit.DialogDisclosure>
				{mode === 'delete' ? (
					<DeleteProjectModal dialogStore={store} project={project} onDeleted={api.deleted} />
				) : (
					<CreateProjectModal
						dialogStore={store}
						mode={mode}
						project={mode === 'rename' ? project : null}
						onCreated={api.created}
					/>
				)}
			</>
		)
	}
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<Harness />
			</QueryClientProvider>
		)
	)
	await click('Open project dialog')
}
function button(name: string) {
	const el = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
		(el) => el.textContent?.trim() === name || el.getAttribute('aria-label') === name
	)
	expect(el).toBeDefined()
	return el!
}
async function click(name: string) {
	await act(async () => button(name).click())
}
async function fill(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
	await act(async () => {
		const proto = input instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype
		Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(input, value)
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
}

test('rename errors preserve both drafts, pending blocks duplicate submission, and retry saves', async () => {
	let reject!: (error: Error) => void
	api.request
		.mockImplementationOnce(
			() =>
				new Promise((_, fail) => {
					reject = fail
				})
		)
		.mockResolvedValue({ project: { ...project, name: 'Draft name' } })
	await mount('rename')
	const input = document.querySelector<HTMLInputElement>('input')!
	const description = document.querySelector<HTMLTextAreaElement>('textarea')!
	await vi.waitFor(() => expect(document.activeElement).toBe(input))
	const dialog = document.querySelector('[role="dialog"]')!
	expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe('Rename project')
	await fill(input, 'Draft name')
	await fill(description, 'Draft description')
	await click('Save')
	await vi.waitFor(() => expect(button('Saving…').getAttribute('aria-disabled')).toBe('true'))
	await click('Saving…')
	expect(api.request).toHaveBeenCalledTimes(1)
	await act(async () => reject(new Error('Offline')))
	await vi.waitFor(() => expect(document.querySelector('[role="alert"]')?.textContent).toContain('Offline'))
	expect(input.value).toBe('Draft name')
	expect(description.value).toBe('Draft description')
	await click('Save')
	await vi.waitFor(() => expect(document.querySelector('[role="dialog"]:not([hidden])')).toBeNull())
	expect(api.request).toHaveBeenLastCalledWith(expect.any(Function), '/projects/qa', {
		method: 'PATCH',
		json: { name: 'Draft name', description: 'Draft description' }
	})
	await vi.waitFor(() => expect(document.activeElement).toBe(button('Open project dialog')))
})

test('delete cancellation, failure and retry retain the named project and complete once', async () => {
	api.request.mockRejectedValueOnce(new Error('Offline')).mockResolvedValue({})
	await mount('delete')
	await click('Cancel')
	expect(api.request).not.toHaveBeenCalled()
	await click('Open project dialog')
	await click('Delete project')
	await vi.waitFor(() => expect(document.querySelector('[role="alert"]')?.textContent).toContain('Offline'))
	expect(document.querySelector('[role="dialog"]')?.textContent).toContain('QA Project')
	expect(api.deleted).not.toHaveBeenCalled()
	await click('Retry deletion')
	await vi.waitFor(() => expect(api.deleted).toHaveBeenCalledTimes(1))
})

test('canceling and reopening creation clears the abandoned draft and stale error', async () => {
	api.request.mockRejectedValueOnce(new Error('Offline'))
	await mount('create')
	await fill(document.querySelector<HTMLInputElement>('input')!, 'Abandoned')
	await click('Create project')
	await vi.waitFor(() => expect(document.querySelector('[role="alert"]')).not.toBeNull())
	await click('Cancel')
	await click('Open project dialog')
	expect(document.querySelector<HTMLInputElement>('input')!.value).toBe('')
	expect(document.querySelector('[role="alert"]')).toBeNull()
})

test('project rows keep independent rename drafts when another row is pending or fails', async () => {
	let reject!: (error: Error) => void
	api.request
		.mockImplementationOnce(
			() =>
				new Promise((_, fail) => {
					reject = fail
				})
		)
		.mockResolvedValue({})
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				{['Alpha', 'Beta'].map((title) => (
					<ProjectSessionItem
						key={title}
						session={{
							sessionId: title,
							title,
							createdAt: '2026-09-07',
							lastActivity: '2026-09-07',
							isPinned: false,
							pinnedAt: null,
							isPublic: false,
							shareToken: null
						}}
						projectId="qa"
						onSelect={() => {}}
						onDelete={() => {}}
						isDeleting={false}
					/>
				))}
			</QueryClientProvider>
		)
	)
	await click('Rename Alpha')
	const alpha = document.querySelector<HTMLInputElement>('input[name="newTitle"]')!
	await fill(alpha, 'Alpha draft')
	await act(async () => alpha.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
	await vi.waitFor(() => expect(reject).toBeTypeOf('function'))
	await click('Rename Beta')
	const beta = [...document.querySelectorAll<HTMLInputElement>('input[name="newTitle"]')].find((el) => el !== alpha)!
	await fill(beta, 'Beta draft')
	await act(async () => reject(new Error('Offline')))
	await vi.waitFor(() => expect(document.querySelector('[role="alert"]')?.textContent).toContain('Offline'))
	expect(alpha.value).toBe('Alpha draft')
	expect(beta.value).toBe('Beta draft')
	expect(beta.disabled).toBe(false)
})

test.each(['success', 'failure'] as const)(
	'late project deletion %s leaves a replacement dialog alone',
	async (outcome) => {
		let resolve!: () => void
		let reject!: (error: Error) => void
		api.request.mockImplementationOnce(
			() =>
				new Promise<void>((done, fail) => {
					resolve = done
					reject = fail
				})
		)
		function Harness({ id }: { id: string }) {
			const store = Ariakit.useDialogStore()
			return (
				<>
					<Ariakit.DialogDisclosure store={store}>Open project dialog</Ariakit.DialogDisclosure>
					<DeleteProjectModal
						key={id}
						dialogStore={store}
						project={{ ...project, id, name: id }}
						onDeleted={api.deleted}
					/>
				</>
			)
		}
		const render = async (id: string) => {
			await act(async () =>
				root.render(
					<QueryClientProvider client={client}>
						<Harness id={id} />
					</QueryClientProvider>
				)
			)
		}
		await render('Alpha')
		await click('Open project dialog')
		await click('Delete project')
		await vi.waitFor(() => expect(api.request).toHaveBeenCalledTimes(1))
		await render('Beta')
		await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')?.hasAttribute('hidden')).toBe(false))
		await act(async () => {
			if (outcome === 'success') resolve()
			else reject(new Error('Offline'))
		})
		await vi.waitFor(() => expect(outcome === 'success' ? api.success : api.error).toHaveBeenCalledTimes(1))
		expect(api.deleted).not.toHaveBeenCalled()
		const dialog = document.querySelector('[role="dialog"]')!
		expect(dialog.textContent).toContain('Beta')
		expect(dialog.hasAttribute('hidden')).toBe(false)
		expect(document.querySelector('[role="alert"]')).toBeNull()
	}
)

test.each([true, false])(
	'sidebar project actions preserve navigation after deletion (switched chat: %s)',
	async (switchedChat) => {
		let savedProject = project
		let removed = false
		const deletion = Promise.withResolvers<void>()
		api.request.mockImplementation(async (_fetch, path, options) => {
			if (path === '/projects') return { projects: removed ? [] : [savedProject] }
			if (path === '/projects/qa/sessions') return { sessions: [] }
			if (options?.method === 'PATCH') {
				savedProject = { ...savedProject, ...options.json }
				return { project: savedProject }
			}
			if (options?.method === 'DELETE') {
				await deletion.promise
				removed = true
				return {}
			}
			throw new Error(`Unexpected project request: ${path}`)
		})
		const renderSidebar = async (currentProjectId: string | null) => {
			await act(async () =>
				root.render(
					<QueryClientProvider client={client}>
						<ProjectsSidebarSection currentProjectId={currentProjectId} onSessionSelect={vi.fn()} onDelete={vi.fn()} />
					</QueryClientProvider>
				)
			)
		}
		const chooseAction = async (name: string) => {
			const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
				(el) => el.textContent?.trim() === name
			)!
			await act(async () => item.click())
		}
		await renderSidebar('qa')
		await vi.waitFor(() => expect(container.textContent).toContain('QA Project'))
		await click('Actions for project QA Project')
		await chooseAction('Rename project')
		await vi.waitFor(() => expect(document.querySelector('input')).not.toBeNull())
		await fill(document.querySelector<HTMLInputElement>('input')!, 'Renamed project')
		await click('Save')
		await vi.waitFor(() => expect(container.textContent).toContain('Renamed project'))
		await vi.waitFor(() => expect(document.querySelector('[role="dialog"]:not([hidden])')).toBeNull())
		expect(api.push).not.toHaveBeenCalled()
		await click('Actions for project Renamed project')
		await chooseAction('Delete project')
		await vi.waitFor(() =>
			expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Attached sessions remain')
		)
		await click('Delete project')
		await vi.waitFor(() => expect(button('Deleting…').getAttribute('aria-disabled')).toBe('true'))
		await click('Deleting…')
		expect(api.request.mock.calls.filter(([, , options]) => options?.method === 'DELETE')).toHaveLength(1)
		if (switchedChat) await renderSidebar(null)
		await act(async () => deletion.resolve())
		await vi.waitFor(() => expect(container.textContent).not.toContain('Renamed project'))
		await vi.waitFor(() => expect(document.querySelector('[role="dialog"]:not([hidden])')).toBeNull())
		expect(api.push.mock.calls).toEqual(switchedChat ? [] : [['/ai/projects']])
		await vi.waitFor(() => expect(document.activeElement).toBe(button('New project')))
	}
)
