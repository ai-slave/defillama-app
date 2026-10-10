// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AI_SERVER } from '~/constants'
import { accessibleName } from '~/utils/testing/accessibleName'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { ProjectLanding } from '../ProjectLanding'

const router = vi.hoisted(() => ({
	pathname: '/ai/projects/[id]',
	query: {} as Record<string, string>,
	replace: vi.fn()
}))
vi.mock('next/router', () => ({ useRouter: () => router, default: {} }))
// Heavy dialogs and menus this suite never opens.
vi.mock('../CreateProjectModal', () => ({ CreateProjectModal: () => null }))
vi.mock('../DeleteProjectModal', () => ({ DeleteProjectModal: () => null }))
vi.mock('../AddSourcesMenu', () => ({ AddSourcesMenu: () => null }))

const session = installSubscriberSession('owner')
const project = (id: string, name: string, instructions: string) => ({
	project: { id, name, custom_instructions: instructions, file_count: 2, total_bytes: 100 }
})
let sessionsReply: () => unknown
let detailReply: () => unknown
const onSubmit = vi.fn()

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	router.query = { id: 'project-1', connectGithub: '1' }
	router.replace.mockReset()
	onSubmit.mockReset()
	sessionsReply = () => ({ sessions: [] })
	detailReply = () => project('project-1', 'Research', 'Saved instructions')
	session.client.setDefaultOptions({ queries: { retry: false } })
	session.serve({
		[`${AI_SERVER}/projects/usage`]: { limits: { project_bytes: 1000, project_files: 10 } },
		[`${AI_SERVER}/projects/project-1`]: (_url: URL, init?: RequestInit) =>
			init?.method === 'PATCH' ? project('project-1', 'Research', JSON.parse(init.body as string)) : detailReply(),
		[`${AI_SERVER}/projects/project-2`]: project('project-2', 'Other', 'Another project'),
		[`${AI_SERVER}/projects/project-1/sessions`]: () => sessionsReply(),
		[`${AI_SERVER}/projects/project-2/sessions`]: { sessions: [] },
		[`${AI_SERVER}/projects/project-1/files`]: { files: [], limit: 500, offset: 0 },
		[`${AI_SERVER}/projects/project-1/sources`]: { sources: [] }
	})
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

async function render(isStreaming = false) {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<ProjectLanding
					projectId={router.query.id}
					tier="paid"
					initialTab={router.query.tab === 'sources' ? 'sources' : 'chats'}
					onSubmit={onSubmit}
					onPickSession={vi.fn()}
					isStreaming={isStreaming}
					enterToSend
				/>
			</session.Wrapper>
		)
	)
}
const until = (assertion: () => void) => waitForUi(assertion, { timeout: 1000 })
async function renderLoaded() {
	await render()
	await until(() => expect(tabs()).toHaveLength(2))
}
const tabs = () => [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
// The instructions textarea is the one its "Instructions" label points at.
const editor = () => {
	const label = [...container.querySelectorAll('label')].find((l) => l.textContent === 'Instructions')!
	return document.getElementById(label.htmlFor) as HTMLTextAreaElement
}
const composer = () => container.querySelector<HTMLTextAreaElement>('[aria-label="New chat in Research"]')!
const panelOf = (element: HTMLElement) => element.closest<HTMLElement>('[role="tabpanel"]')!
const visiblePanels = () => [...container.querySelectorAll<HTMLElement>('[role="tabpanel"]')].filter((p) => !p.hidden)
const button = (text: string) => [...container.querySelectorAll('button')].find((b) => b.textContent?.includes(text))!
const requested = (path: string) => session.requests.some(({ url }) => url.pathname === path)
const patches = () =>
	session.requests.filter(({ init }) => init?.method === 'PATCH').map(({ init }) => JSON.parse(init!.body as string))

function type(textarea: HTMLTextAreaElement, value: string) {
	Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, value)
	textarea.dispatchEvent(new Event('input', { bubbles: true }))
}
async function press(element: HTMLElement, key: string) {
	await act(async () => {
		element.focus()
		element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
		element.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }))
		await new Promise((resolve) => setTimeout(resolve, 30))
	})
}

test('focus does not load Sources; activation preserves project and GitHub query parameters', async () => {
	await renderLoaded()
	const [chats, sources] = tabs()
	expect(panelOf(editor()).hidden).toBe(true)
	await press(chats, 'ArrowRight')
	expect(document.activeElement).toBe(sources)
	expect(requested('/projects/project-1/files')).toBe(false)
	expect(router.replace).not.toHaveBeenCalled()
	await press(sources, 'Enter')
	expect(router.replace.mock.calls).toEqual([
		[
			{ pathname: '/ai/projects/[id]', query: { id: 'project-1', connectGithub: '1', tab: 'sources' } },
			undefined,
			{ shallow: true }
		]
	])
	router.query.tab = 'sources'
	await render()
	const panel = document.getElementById(sources.getAttribute('aria-controls')!)!
	expect(panel.getAttribute('aria-labelledby')).toBe(sources.id)
	expect(panel.hidden).toBe(false)
	await until(() => expect(requested('/projects/project-1/files')).toBe(true))
	expect(document.activeElement).toBe(sources)
	router.replace.mockClear()
	await press(sources, 'Home')
	expect(document.activeElement).toBe(chats)
	await press(chats, ' ')
	expect(router.replace.mock.calls).toEqual([
		[{ pathname: '/ai/projects/[id]', query: { id: 'project-1', connectGithub: '1' } }, undefined, { shallow: true }]
	])
})

test('tab changes preserve both drafts and show the composer only on Chats', async () => {
	await renderLoaded()
	expect(panelOf(composer()).hidden).toBe(false)
	await act(async () => type(composer(), 'Unsent question'))
	router.query.tab = 'sources'
	await render()
	expect(panelOf(composer()).hidden).toBe(true)
	await act(async () => type(editor(), 'Unsaved local draft'))
	delete router.query.tab
	await render()
	expect(editor().value).toBe('Unsaved local draft')
	expect(panelOf(composer()).hidden).toBe(false)
	expect(composer().value).toBe('Unsent question')
	router.query.tab = 'sources'
	await render()
	expect(visiblePanels()).toHaveLength(1)
	expect(router.replace).not.toHaveBeenCalled()
	expect(patches()).toEqual([])
	await act(async () => editor().dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
	await until(() => expect(patches()).toEqual([{ custom_instructions: 'Unsaved local draft' }]))
	router.query.id = 'project-2'
	await render()
	await until(() => expect(editor().value).toBe('Another project'))
})

test('chat loading, failure and retry never present a false empty state', async () => {
	let finishLoading = () => {}
	sessionsReply = () => new Promise((resolve) => (finishLoading = () => resolve(Response.json({}, { status: 500 }))))
	await renderLoaded()
	expect(container.textContent).toContain('Loading chats')
	expect(container.textContent).not.toContain('No chats yet')
	await act(async () => finishLoading())
	await until(() => expect(container.querySelector('[role="alert"]')?.textContent).toContain("Couldn't load chats."))
	expect(container.textContent).not.toContain('No chats yet')

	let finishRetry = () => {}
	sessionsReply = () => new Promise((resolve) => (finishRetry = () => resolve({ sessions: [] })))
	const retry = button('Try again')
	await act(async () => retry.click())
	await until(() => expect(accessibleName(retry)).toBe('Retrying…'))
	expect(container.querySelector('[role="alert"]')?.textContent).toContain("Couldn't load chats.")
	expect(container.textContent).not.toContain('No chats yet')
	await act(async () => finishRetry())
	await until(() => expect(container.textContent).toContain('No chats yet'))
	expect(container.querySelector('[role="alert"]')).toBeNull()
})

test('blank and streaming submissions are disabled but keep focus; rejected submissions keep the draft', async () => {
	await renderLoaded()
	const submit = container.querySelector<HTMLButtonElement>('[aria-label="Send message"]')!
	expect(submit.disabled).toBe(false)
	expect(submit.getAttribute('aria-disabled')).toBe('true')
	await act(async () => type(composer(), 'Question'))
	await render(true)
	expect(submit.getAttribute('aria-disabled')).toBe('true')
	await act(async () => submit.click())
	await act(async () => composer().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
	expect(onSubmit).not.toHaveBeenCalled()
	onSubmit.mockReturnValue(false)
	await render()
	expect(submit.getAttribute('aria-disabled')).toBeNull()
	await act(async () => submit.click())
	expect(onSubmit).toHaveBeenLastCalledWith('Question', undefined, undefined)
	expect(composer().value).toBe('Question')
	onSubmit.mockReturnValue(true)
	await act(async () => submit.click())
	expect(composer().value).toBe('')
})

test('a second Enter while a send is on its way sends it once and keeps the text until it is accepted', async () => {
	await renderLoaded()
	const accepted = Promise.withResolvers<boolean>()
	onSubmit.mockReturnValue(accepted.promise)
	await act(async () => type(composer(), 'Question'))
	const enter = () => composer().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
	await act(async () => enter())
	await act(async () => enter())
	expect(onSubmit).toHaveBeenCalledTimes(1)
	expect(composer().readOnly).toBe(true)
	expect(container.querySelector('[aria-label="Send message"]')!.getAttribute('aria-busy')).toBe('true')
	await act(async () => accepted.resolve(true))
	expect(composer().value).toBe('')
	expect(composer().readOnly).toBe(false)
})

test('an attachment that cannot be read keeps the draft, says so and leaves the composer editable', async () => {
	await renderLoaded()
	await act(async () => type(composer(), 'Question'))
	const input = container.querySelector<HTMLInputElement>('input[type="file"]')!
	await act(async () => {
		Object.defineProperty(input, 'files', { value: [new File(['png'], 'chart.png', { type: 'image/png' })] })
		input.dispatchEvent(new Event('change', { bubbles: true }))
	})
	vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (this: FileReader) {
		queueMicrotask(() => this.dispatchEvent(new ProgressEvent('error')))
	})
	try {
		await act(async () => composer().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
		await until(() =>
			expect(container.querySelector('[role="alert"]')?.textContent).toBe(
				"Couldn't read an attachment. Remove it or attach it again, then send."
			)
		)
	} finally {
		vi.restoreAllMocks()
	}
	expect(onSubmit).not.toHaveBeenCalled()
	expect(composer().value).toBe('Question')
	expect(composer().readOnly).toBe(false)
})

test('only the route-selected panel is visible while tab navigation is pending', async () => {
	await renderLoaded()
	router.replace.mockImplementation(() => new Promise(() => {}))
	await act(async () => tabs()[1].click())
	expect(visiblePanels()).toEqual([panelOf(composer())])
	router.query.tab = 'sources'
	await render()
	expect(visiblePanels()).toHaveLength(1)
	expect(panelOf(composer()).hidden).toBe(true)
})

test.each([403, 404])('shows the same not-found page for inaccessible or missing projects (%s)', async (status) => {
	detailReply = () => Response.json({ error: 'Private server detail' }, { status })
	await render()
	await until(() => expect(container.querySelector('h1')?.textContent).toBe('Project not found'))
	expect(container.textContent).not.toContain('Private server detail')
	expect(container.querySelector('a[href="/ai/projects"]')).not.toBeNull()
	expect(container.textContent).not.toContain('Try again')
})

test('keeps retry available for temporary project failures', async () => {
	detailReply = () => Response.json({ error: 'Service unavailable' }, { status: 503 })
	await render()
	await until(() =>
		expect(container.querySelector('[role="alert"]')?.textContent).toContain('Couldn’t load this project.')
	)
	detailReply = () => project('project-1', 'Research', 'Saved instructions')
	await act(async () => button('Try again').click())
	await until(() => expect(tabs()).toHaveLength(2))
})

test('deleting a chat hands focus to the next chat once the list drops it', async () => {
	const chat = (sessionId: string, title: string) => ({
		sessionId,
		title,
		createdAt: '2026-09-01T00:00:00Z',
		lastActivity: null,
		isPinned: false,
		pinnedAt: null,
		isPublic: false,
		shareToken: null
	})
	let chats = [chat('first', 'First chat'), chat('second', 'Second chat')]
	sessionsReply = () => ({ sessions: chats })
	session.serve({
		[`${AI_SERVER}/user/sessions/first`]: () => {
			chats = [chats[1]]
			return new Response(null, { status: 204 })
		}
	})
	await renderLoaded()
	await until(() => expect(container.textContent).toContain('Second chat'))
	const remove = container.querySelector<HTMLButtonElement>('button[aria-label="Delete First chat"]')!
	await act(async () => {
		remove.focus()
		remove.click()
	})
	const confirm = await waitForUi(() => {
		const found = [...document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')].find(
			(b) => b.textContent === 'Delete'
		)
		expect(found).toBeDefined()
		return found!
	})
	await act(async () => confirm.click())
	await until(() => expect(container.textContent).not.toContain('First chat'))
	await until(() =>
		expect(document.activeElement).toBe(container.querySelector('button[aria-label="Delete Second chat"]'))
	)
})

test('cancelling a chat delete returns focus to its Delete button', async () => {
	sessionsReply = () => ({
		sessions: [
			{
				sessionId: 'first',
				title: 'First chat',
				createdAt: '2026-09-01T00:00:00Z',
				lastActivity: null,
				isPinned: false,
				pinnedAt: null,
				isPublic: false,
				shareToken: null
			}
		]
	})
	await renderLoaded()
	await until(() => expect(container.textContent).toContain('First chat'))
	const remove = container.querySelector<HTMLButtonElement>('button[aria-label="Delete First chat"]')!
	await act(async () => {
		remove.focus()
		remove.click()
	})
	const cancel = await waitForUi(() => {
		const found = [...document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')].find(
			(b) => b.textContent === 'Cancel'
		)
		expect(found).toBeDefined()
		return found!
	})
	await act(async () => cancel.click())
	await until(() => expect(document.querySelector('[role="alertdialog"]')).toBeNull())
	await until(() => expect(document.activeElement).toBe(remove))
})
