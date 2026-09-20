// @vitest-environment happy-dom

import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { LlamaAITransportError } from '~/containers/LlamaAI/api/transport'
import { ProjectLanding } from './ProjectLanding'

const mocks = vi.hoisted(() => ({
	projectError: null as Error | null,
	refetchProject: vi.fn(),
	router: { pathname: '/ai/projects/[id]', query: { id: 'project-1' } as Record<string, string>, replace: vi.fn() },
	updateProject: vi.fn(),
	filesRendered: vi.fn(),
	instructions: 'Saved instructions',
	sessions: { data: [], isLoading: false, isFetching: false, error: null as Error | null, refetch: vi.fn() },
	isStreaming: false,
	onSubmit: vi.fn(),
	clearImages: vi.fn()
}))
vi.mock('next/router', () => ({ useRouter: () => mocks.router, default: {} }))

// react-query replaces a result object when its state changes, so `setSessions` does too. Mutating one
// in place leaves the identity untouched, which a memo cannot see.
function setSessions(patch: Partial<typeof mocks.sessions>): void {
	mocks.sessions = { ...mocks.sessions, ...patch }
}
vi.mock('./hooks', () => ({
	useProjectUsage: () => ({ data: { limits: { project_bytes: 1000, project_files: 10 } } }),
	useProjectDetail: () => ({
		data: mocks.projectError
			? undefined
			: { name: 'Research', custom_instructions: mocks.instructions, file_count: 2, total_bytes: 100 },
		error: mocks.projectError,
		refetch: mocks.refetchProject
	}),
	useProjectSessions: () => ({ ...mocks.sessions }),
	useUpdateProject: () => ({ isPending: false, error: null, mutate: mocks.updateProject })
}))
vi.mock('./ProjectFilesPanel', () => ({
	ProjectFilesPanel: (props: object) => {
		mocks.filesRendered(props)
		return <input aria-label="Files search" />
	}
}))
vi.mock('./CreateProjectModal', () => ({ CreateProjectModal: () => null }))
vi.mock('./DeleteProjectModal', () => ({ DeleteProjectModal: () => null }))
vi.mock('./AddSourcesMenu', () => ({ AddSourcesMenu: () => null }))
vi.mock('~/containers/LlamaAI/hooks/useClearUnseenCompletion', () => ({ useClearUnseenCompletion: () => vi.fn() }))
vi.mock('~/containers/LlamaAI/hooks/useDeleteSession', () => ({ useDeleteSession: () => ({ isPending: false }) }))
vi.mock('~/containers/LlamaAI/hooks/useUpdateSessionTitle', () => ({
	useUpdateSessionTitle: () => ({ isPending: false })
}))
vi.mock('~/containers/LlamaAI/hooks/usePromptDraft', () => ({
	usePromptDraft: () => {
		const [prompt, setPrompt] = useState('')
		return [prompt, setPrompt] as const
	}
}))
vi.mock('~/containers/LlamaAI/hooks/useImageUpload', () => ({
	useImageUpload: () => ({ selectedImages: [], clearImages: mocks.clearImages })
}))
vi.mock('~/containers/LlamaAI/components/input/ImageUpload', () => ({
	ImageUpload: () => null
}))
vi.mock('~/containers/LlamaAI/components/PastedContentModal', () => ({ PastedContentModal: () => null }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	vi.clearAllMocks()
	mocks.projectError = null
	mocks.router.query = { id: 'project-1', connectGithub: '1' }
	mocks.instructions = 'Saved instructions'
	setSessions({ isLoading: false })
	setSessions({ isFetching: false })
	setSessions({ error: null })
	mocks.isStreaming = false
	mocks.updateProject.mockResolvedValue(undefined)
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})
async function render() {
	await act(async () =>
		root.render(
			<ProjectLanding
				projectId={mocks.router.query.id}
				tier="paid"
				initialTab={mocks.router.query.tab === 'sources' ? 'sources' : 'chats'}
				onSubmit={mocks.onSubmit}
				onPickSession={vi.fn()}
				isStreaming={mocks.isStreaming}
				enterToSend
			/>
		)
	)
}
function tabs() {
	return [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
}
function editor() {
	return container.querySelector<HTMLTextAreaElement>('[role="tabpanel"] textarea')!
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
	await render()
	const [chats, sources] = tabs()
	expect(editor()).not.toBeNull()
	expect(editor().closest('[role="tabpanel"]')!.hasAttribute('hidden')).toBe(true)
	await press(chats, 'ArrowRight')
	expect(document.activeElement).toBe(sources)
	expect(mocks.filesRendered).not.toHaveBeenCalled()
	expect(mocks.router.replace).not.toHaveBeenCalled()
	await press(sources, 'Enter')
	expect(mocks.router.replace.mock.calls).toEqual([
		[
			{ pathname: '/ai/projects/[id]', query: { id: 'project-1', connectGithub: '1', tab: 'sources' } },
			undefined,
			{ shallow: true }
		]
	])
	mocks.router.query.tab = 'sources'
	await render()
	const panel = document.getElementById(sources.getAttribute('aria-controls')!)!
	expect(panel.getAttribute('aria-labelledby')).toBe(sources.id)
	expect(panel.hidden).toBe(false)
	expect(mocks.filesRendered).toHaveBeenLastCalledWith(
		expect.objectContaining({ autoOpenGitHub: true, projectId: 'project-1', projectFileCount: 2 })
	)
	expect(document.activeElement).toBe(sources)
	mocks.router.replace.mockClear()
	await press(sources, 'Home')
	expect(document.activeElement).toBe(chats)
	await press(chats, ' ')
	expect(mocks.router.replace.mock.calls).toEqual([
		[{ pathname: '/ai/projects/[id]', query: { id: 'project-1', connectGithub: '1' } }, undefined, { shallow: true }]
	])
})

test('tab changes preserve drafts and show the composer only on Chats', async () => {
	function chatInput() {
		return container.querySelector<HTMLTextAreaElement>('[aria-label="New chat in Research"]')!
	}
	await render()
	expect(chatInput().closest<HTMLElement>('[role="tabpanel"]')!.hidden).toBe(false)
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(chatInput(), 'Unsent question')
		chatInput().dispatchEvent(new Event('input', { bubbles: true }))
	})
	mocks.router.query.tab = 'sources'
	await render()
	expect(chatInput().closest<HTMLElement>('[role="tabpanel"]')!.hidden).toBe(true)
	const instructions = editor()
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(
			instructions,
			'Unsaved local draft'
		)
		instructions.dispatchEvent(new Event('input', { bubbles: true }))
	})
	expect(container.textContent).toContain('Unsaved')
	delete mocks.router.query.tab
	await render()
	expect(editor().value).toBe('Unsaved local draft')
	expect(chatInput().closest<HTMLElement>('[role="tabpanel"]')!.hidden).toBe(false)
	expect(chatInput().value).toBe('Unsent question')
	expect(container.querySelector('[aria-label="Files search"]')).toBeNull()
	mocks.instructions = 'Server refresh'
	mocks.router.query.tab = 'sources'
	await render()
	expect(editor().value).toBe('Unsaved local draft')
	expect(chatInput().closest<HTMLElement>('[role="tabpanel"]')!.hidden).toBe(true)
	expect(chatInput().value).toBe('Unsent question')
	expect(container.querySelector('[aria-label="Files search"]')).not.toBeNull()
	expect(container.querySelectorAll('[role="tabpanel"]:not([hidden])')).toHaveLength(1)
	expect(mocks.router.replace).not.toHaveBeenCalled()
	expect(mocks.updateProject).not.toHaveBeenCalled()
	await act(async () => editor().dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
	expect(mocks.updateProject).toHaveBeenCalledExactlyOnceWith({ custom_instructions: 'Unsaved local draft' })
	mocks.router.query.id = 'project-2'
	mocks.instructions = 'Another project'
	await render()
	expect(editor().value).toBe('Another project')
})

test('chat loading, failure and retry never present a false empty state', async () => {
	setSessions({ isLoading: true })
	await render()
	expect(container.textContent).toContain('Loading chats')
	expect(container.textContent).not.toContain('No chats yet')
	setSessions({ isLoading: false })
	setSessions({ error: new Error('Unavailable') })
	await render()
	expect(container.querySelector('[role="alert"]')?.textContent).toContain("Couldn't load chats.")
	expect(container.textContent).not.toContain('No chats yet')
	await act(async () =>
		[...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Retry chats'))!.click()
	)
	expect(mocks.sessions.refetch).toHaveBeenCalledOnce()
	setSessions({ isFetching: true })
	await render()
	const retry = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Retrying…'))!
	expect(retry.disabled).toBe(true)
	setSessions({ error: null })
	setSessions({ isFetching: false })
	await render()
	expect(container.querySelector('[role="alert"]')).toBeNull()
	expect(container.textContent).toContain('No chats yet')
})

test('blank and streaming submissions are disabled; rejected submissions keep the draft', async () => {
	await render()
	const composer = container.querySelector<HTMLTextAreaElement>('[aria-label="New chat in Research"]')!
	const submit = container.querySelector<HTMLButtonElement>('[aria-label="Send message"]')!
	expect(submit.disabled).toBe(true)
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(composer, 'Question')
		composer.dispatchEvent(new Event('input', { bubbles: true }))
	})
	mocks.isStreaming = true
	await render()
	expect(submit.disabled).toBe(true)
	await act(async () => composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
	expect(mocks.onSubmit).not.toHaveBeenCalled()
	mocks.isStreaming = false
	mocks.onSubmit.mockReturnValue(false)
	await render()
	expect(submit.disabled).toBe(false)
	await act(async () => submit.click())
	expect(composer.value).toBe('Question')
	expect(mocks.clearImages).not.toHaveBeenCalled()
	mocks.onSubmit.mockReturnValue(true)
	await act(async () => submit.click())
	expect(composer.value).toBe('')
	expect(mocks.clearImages).toHaveBeenCalledOnce()
})

test('only the route-selected panel is visible while tab navigation is pending', async () => {
	await render()
	mocks.router.replace.mockImplementation(() => new Promise(() => {}))
	await act(async () => tabs()[1].click())
	expect(
		[...container.querySelectorAll<HTMLElement>('[role="tabpanel"]')].filter((panel) => !panel.hidden)
	).toHaveLength(1)
	expect(
		container
			.querySelector<HTMLTextAreaElement>('[aria-label="New chat in Research"]')!
			.closest<HTMLElement>('[role="tabpanel"]')!.hidden
	).toBe(false)
	mocks.router.query.tab = 'sources'
	await render()
	expect(
		[...container.querySelectorAll<HTMLElement>('[role="tabpanel"]')].filter((panel) => !panel.hidden)
	).toHaveLength(1)
	expect(
		container
			.querySelector<HTMLTextAreaElement>('[aria-label="New chat in Research"]')!
			.closest<HTMLElement>('[role="tabpanel"]')!.hidden
	).toBe(true)
})

test.each([403, 404])('shows the same not-found page for inaccessible or missing projects (%s)', async (status) => {
	mocks.projectError = new LlamaAITransportError('Private server detail', status, {})
	await render()
	expect(container.querySelector('[role="alert"]')?.textContent).toBe('Project not found')
	expect(container.textContent).not.toContain('Private server detail')
	expect(container.querySelector('a[href="/ai/projects"]')).not.toBeNull()
	expect(container.textContent).not.toContain('Try again')
})

test('keeps retry available for temporary project failures', async () => {
	mocks.projectError = new LlamaAITransportError('Service unavailable', 503, {})
	await render()
	expect(container.querySelector('[role="alert"]')?.textContent).toBe('Project unavailable')
	await act(async () =>
		[...container.querySelectorAll('button')].find((button) => button.textContent === 'Try again')!.click()
	)
	expect(mocks.refetchProject).toHaveBeenCalledOnce()
})
