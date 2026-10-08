// @vitest-environment happy-dom
import * as Ariakit from '@ariakit/react'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AI_SERVER } from '~/constants'
import { LlamaAIChromeContext } from '~/containers/LlamaAI/chrome'
import { accessibleName } from '~/utils/testing/accessibleName'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { CreateProjectModal } from '../CreateProjectModal'
import { DeleteProjectModal } from '../DeleteProjectModal'
import { ProjectSessionItem } from '../ProjectSessionItem'
import { ProjectsSidebarSection } from '../ProjectsSidebarSection'
import type { Project } from '../types'

const api = vi.hoisted(() => ({
	request: vi.fn(),
	created: vi.fn(),
	deleted: vi.fn(),
	success: vi.fn(),
	error: vi.fn(),
	push: vi.fn()
}))
vi.mock('next/router', () => ({ useRouter: () => ({ push: api.push }) }))
vi.mock('react-hot-toast', () => ({ default: { success: api.success, error: api.error } }))

// Every LlamaAI request reaches `api.request(path, { method, json })`, which plays the AI server.
const session = installSubscriberSession('user')
const chrome = {
	toggleSidebar: () => {},
	hideSidebar: () => {},
	toggleFullscreen: () => {},
	isFullscreen: false,
	fullscreenLocked: false,
	sidebarVisible: true,
	toggleDashboardPanel: () => {},
	isDashboardPanelOpen: false
}
function Providers({ children }: { children: ReactNode }) {
	return (
		<session.Wrapper>
			<LlamaAIChromeContext.Provider value={chrome}>{children}</LlamaAIChromeContext.Provider>
		</session.Wrapper>
	)
}
let root: Root
let container: HTMLDivElement
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
// The plan's project cap, which the create dialog reads before sending anything.
let usage: { project_count: number; limits: { projects: number | null } }
beforeEach(() => {
	vi.resetAllMocks()
	localStorage.setItem('llamaai:sidebar-projects-open', 'true')
	usage = { project_count: 1, limits: { projects: null } }
	session.serve({
		[`${AI_SERVER}/projects/usage`]: () => Response.json(usage),
		[AI_SERVER]: (url: URL, init?: RequestInit) =>
			api.request(url.href.slice(AI_SERVER.length), {
				method: init?.method,
				json: init?.body ? JSON.parse(init.body as string) : undefined
			})
	})
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})
async function mount(mode: 'create' | 'rename' | 'delete') {
	function Harness() {
		const store = Ariakit.useDialogStore()
		const open = Ariakit.useStoreState(store, 'open')
		return (
			<>
				<Ariakit.DialogDisclosure store={store}>Open project dialog</Ariakit.DialogDisclosure>
				{mode === 'delete' ? (
					open ? (
						<DeleteProjectModal project={project} onClose={store.hide} onDeleted={api.deleted} />
					) : null
				) : (
					<CreateProjectModal
						dialogStore={store}
						project={mode === 'rename' ? project : null}
						onCreated={api.created}
					/>
				)}
			</>
		)
	}
	await act(async () =>
		root.render(
			<Providers>
				<Harness />
			</Providers>
		)
	)
	await click('Open project dialog')
}
function button(name: string) {
	const el = [...document.querySelectorAll<HTMLButtonElement>('button')].find((el) => accessibleName(el) === name)
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

// The error a control's Field shows under it (src/ui/Field.tsx), or null.
const errorOf = (control: Element) =>
	control.getAttribute('aria-invalid') === 'true'
		? (document.getElementById(control.getAttribute('aria-describedby')!.split(' ').at(-1)!)?.textContent ?? null)
		: null

test('rename errors preserve both drafts, pending blocks duplicate submission, and a retry keeps the error until it saves', async () => {
	let reject!: (error: Error) => void
	const retry = Promise.withResolvers<{ project: Project }>()
	api.request
		.mockImplementationOnce(
			() =>
				new Promise((_, fail) => {
					reject = fail
				})
		)
		.mockReturnValueOnce(retry.promise)
	await mount('rename')
	const input = document.querySelector<HTMLInputElement>('input')!
	const description = document.querySelector<HTMLTextAreaElement>('textarea')!
	await waitForUi(() => expect(document.activeElement).toBe(input))
	const dialog = document.querySelector('[role="dialog"]')!
	expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe('Rename project')
	await fill(input, 'Draft name')
	await fill(description, 'Draft description')
	await click('Save')
	await waitForUi(() => expect(button('Saving…').getAttribute('aria-disabled')).toBe('true'))
	await click('Saving…')
	expect(api.request).toHaveBeenCalledTimes(1)
	await act(async () => reject(new Error('Offline')))
	await waitForUi(() =>
		expect(document.querySelector('[role="alert"]')?.textContent).toBe("Couldn't save the project. Try again.")
	)
	expect(input.value).toBe('Draft name')
	expect(description.value).toBe('Draft description')
	await click('Save')
	// The failure stays on screen while its retry runs.
	await waitForUi(() => expect(button('Saving…')).toBeDefined())
	expect(document.querySelector('[role="alert"]')?.textContent).toBe("Couldn't save the project. Try again.")
	await act(async () => retry.resolve({ project: { ...project, name: 'Draft name' } }))
	await waitForUi(() => expect(document.querySelector('[role="dialog"]:not([hidden])')).toBeNull())
	expect(api.request).toHaveBeenLastCalledWith('/projects/qa', {
		method: 'PATCH',
		json: { name: 'Draft name', description: 'Draft description' }
	})
	await waitForUi(() => expect(document.activeElement).toBe(button('Open project dialog')))
})

test('delete cancellation, failure and retry retain the named project and complete once', async () => {
	api.request.mockRejectedValueOnce(new Error('Offline')).mockResolvedValue({})
	await mount('delete')
	await click('Cancel')
	expect(api.request).not.toHaveBeenCalled()
	await click('Open project dialog')
	await click('Delete project')
	await waitForUi(() =>
		expect(document.querySelector('[role="alert"]')?.textContent).toBe("Couldn't delete this project. Try again.")
	)
	expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('QA Project')
	expect(api.deleted).not.toHaveBeenCalled()
	await click('Delete project')
	await waitForUi(() => expect(api.deleted).toHaveBeenCalledTimes(1))
})

test('creating with a blank name names the field instead of sending', async () => {
	await mount('create')
	const input = document.querySelector<HTMLInputElement>('input')!
	await fill(input, '   ')
	await click('Create project')
	expect(errorOf(input)).toBe('Enter a name for the project.')
	expect(document.activeElement).toBe(input)
	expect(api.request).not.toHaveBeenCalled()
	await fill(input, 'Research')
	expect(errorOf(input)).toBeNull()
})

test('at the plan cap, creating says why it is unavailable instead of sending', async () => {
	usage = { project_count: 3, limits: { projects: 3 } }
	await mount('create')
	await waitForUi(() =>
		expect(document.body.textContent).toContain('Your plan allows 3 projects. Delete one to create another.')
	)
	await fill(document.querySelector<HTMLInputElement>('input')!, 'Research')
	await click('Create project')
	expect(api.request).not.toHaveBeenCalled()
})

test('canceling a typed project asks first, and reopening starts without the abandoned draft or error', async () => {
	api.request.mockRejectedValueOnce(new Error('Offline'))
	await mount('create')
	await fill(document.querySelector<HTMLInputElement>('input')!, 'Abandoned')
	await click('Create project')
	await waitForUi(() => expect(document.querySelector('[role="alert"]')).not.toBeNull())
	await click('Cancel')
	// A typed name is work, so Cancel asks before dropping it.
	expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('Discard this project?')
	await click('Discard')
	await waitForUi(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
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
			<Providers>
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
					/>
				))}
			</Providers>
		)
	)
	await click('Rename Alpha')
	const alpha = document.querySelector<HTMLInputElement>('input[name="newTitle"]')!
	await fill(alpha, 'Alpha draft')
	await act(async () => alpha.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
	await waitForUi(() => expect(reject).toBeTypeOf('function'))
	await click('Rename Beta')
	const beta = [...document.querySelectorAll<HTMLInputElement>('input[name="newTitle"]')].find((el) => el !== alpha)!
	await fill(beta, 'Beta draft')
	await act(async () => reject(new Error('Offline')))
	await waitForUi(() => expect(document.querySelector('[role="alert"]')?.textContent).toContain('Offline'))
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
				new Promise((done, fail) => {
					resolve = () => done({})
					reject = fail
				})
		)
		function Harness({ id }: { id: string }) {
			const store = Ariakit.useDialogStore()
			const open = Ariakit.useStoreState(store, 'open')
			return (
				<>
					<Ariakit.DialogDisclosure store={store}>Open project dialog</Ariakit.DialogDisclosure>
					{open ? (
						<DeleteProjectModal
							key={id}
							project={{ ...project, id, name: id }}
							onClose={store.hide}
							onDeleted={api.deleted}
						/>
					) : null}
				</>
			)
		}
		const render = async (id: string) => {
			await act(async () =>
				root.render(
					<Providers>
						<Harness id={id} />
					</Providers>
				)
			)
		}
		await render('Alpha')
		await click('Open project dialog')
		await click('Delete project')
		await waitForUi(() => expect(api.request).toHaveBeenCalledTimes(1))
		await render('Beta')
		await waitForUi(() => expect(document.querySelector('[role="alertdialog"]')?.hasAttribute('hidden')).toBe(false))
		await act(async () => {
			if (outcome === 'success') resolve()
			else reject(new Error('Offline'))
		})
		await waitForUi(() => expect(outcome === 'success' ? api.success : api.error).toHaveBeenCalledTimes(1))
		expect(api.deleted).not.toHaveBeenCalled()
		const dialog = document.querySelector('[role="alertdialog"]')!
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
		api.request.mockImplementation(async (path, options) => {
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
					<Providers>
						<ProjectsSidebarSection currentProjectId={currentProjectId} onSessionSelect={vi.fn()} onDelete={vi.fn()} />
					</Providers>
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
		await waitForUi(() => expect(container.textContent).toContain('QA Project'))
		await click('Actions for project QA Project')
		await chooseAction('Rename project')
		await waitForUi(() => expect(document.querySelector('input')).not.toBeNull())
		await fill(document.querySelector<HTMLInputElement>('input')!, 'Renamed project')
		await click('Save')
		await waitForUi(() => expect(container.textContent).toContain('Renamed project'))
		await waitForUi(() => expect(document.querySelector('[role="dialog"]:not([hidden])')).toBeNull())
		expect(api.push).not.toHaveBeenCalled()
		const openDeleteConfirm = async () => {
			await act(async () => button('Actions for project Renamed project').focus())
			await click('Actions for project Renamed project')
			await chooseAction('Delete project')
			await waitForUi(() =>
				expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('Attached sessions remain')
			)
		}
		await openDeleteConfirm()
		// A cancel returns to the project's menu, not to New project.
		await click('Cancel')
		await waitForUi(() => expect(document.activeElement).toBe(button('Actions for project Renamed project')))
		await openDeleteConfirm()
		await click('Delete project')
		await waitForUi(() => expect(button('Deleting…').getAttribute('aria-disabled')).toBe('true'))
		await click('Deleting…')
		expect(api.request.mock.calls.filter(([, options]) => options?.method === 'DELETE')).toHaveLength(1)
		if (switchedChat) await renderSidebar(null)
		await act(async () => deletion.resolve())
		await waitForUi(() => expect(container.textContent).not.toContain('Renamed project'))
		await waitForUi(() => expect(document.querySelector('[role="alertdialog"]:not([hidden])')).toBeNull())
		expect(api.push.mock.calls).toEqual(switchedChat ? [] : [['/ai/projects']])
		await waitForUi(() => expect(document.activeElement).toBe(button('New project')))
	}
)

test('a failed chat rename keeps its error while the retry saves', async () => {
	const retry = Promise.withResolvers<Record<string, never>>()
	api.request.mockRejectedValueOnce(new Error('Offline')).mockReturnValueOnce(retry.promise)
	await act(async () =>
		root.render(
			<Providers>
				<ProjectSessionItem
					session={{
						sessionId: 'Alpha',
						title: 'Alpha',
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
				/>
			</Providers>
		)
	)
	await click('Rename Alpha')
	const input = document.querySelector<HTMLInputElement>('input[name="newTitle"]')!
	await fill(input, 'Alpha draft')
	await act(async () => input.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
	await waitForUi(() => expect(document.querySelector('[role="alert"]')?.textContent).toContain('Offline'))
	await act(async () => input.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
	await waitForUi(() => expect(button('Saving…')).toBeDefined())
	expect(document.querySelector('[role="alert"]')?.textContent).toContain('Offline')
	await act(async () => retry.resolve({}))
	await waitForUi(() => expect(document.querySelector('input[name="newTitle"]')).toBeNull())
})
