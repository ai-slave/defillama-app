// @vitest-environment happy-dom

import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ProjectLanding } from './ProjectLanding'

const mocks = vi.hoisted(() => ({
	router: { pathname: '/ai/projects/[id]', query: { id: 'project-1' } as Record<string, string>, replace: vi.fn() },
	updateProject: vi.fn(),
	filesRendered: vi.fn(),
	instructions: 'Saved instructions'
}))
vi.mock('next/router', () => ({ useRouter: () => mocks.router, default: {} }))
vi.mock('./hooks', () => ({
	useProjectUsage: () => ({ data: { limits: { project_bytes: 1000, project_files: 10 } } }),
	useProjectDetail: () => ({
		data: { name: 'Research', custom_instructions: mocks.instructions, file_count: 2, total_bytes: 100 }
	}),
	useProjectSessions: () => ({ data: [] }),
	useUpdateProject: () => ({ isPending: false, mutateAsync: mocks.updateProject })
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
vi.mock('~/containers/LlamaAI/hooks/useSessionMutations', () => ({ useSessionMutations: () => ({}) }))
vi.mock('~/containers/LlamaAI/hooks/usePromptDraft', () => ({
	usePromptDraft: () => {
		const [prompt, setPrompt] = useState('')
		return [prompt, setPrompt] as const
	}
}))
vi.mock('~/containers/LlamaAI/hooks/useImageUpload', () => ({ useImageUpload: () => ({ selectedImages: [] }) }))
vi.mock('~/containers/LlamaAI/components/input/ImageUpload', () => ({
	DragOverlay: () => null,
	ImageUpload: () => null
}))
vi.mock('~/containers/LlamaAI/components/PastedContentModal', () => ({ PastedContentModal: () => null }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	vi.clearAllMocks()
	mocks.router.query = { id: 'project-1', connectGithub: '1' }
	mocks.instructions = 'Saved instructions'
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
				onSubmit={vi.fn()}
				onPickSession={vi.fn()}
				isStreaming={false}
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

test('URL switches retain the real instructions draft and composer, but unmount Sources files', async () => {
	mocks.router.query.tab = 'sources'
	await render()
	const instructions = editor()
	const composer = container.querySelector<HTMLTextAreaElement>('textarea[placeholder="New chat in Research"]')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(
			instructions,
			'Unsaved local draft'
		)
		instructions.dispatchEvent(new Event('input', { bubbles: true }))
		Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(composer, 'Unsent question')
		composer.dispatchEvent(new Event('input', { bubbles: true }))
	})
	expect(container.textContent).toContain('Unsaved')
	delete mocks.router.query.tab
	await render()
	expect(editor()).toBe(instructions)
	expect(container.querySelector<HTMLTextAreaElement>('textarea[placeholder="New chat in Research"]')!.value).toBe(
		'Unsent question'
	)
	expect(container.querySelector('[aria-label="Files search"]')).toBeNull()
	mocks.instructions = 'Server refresh'
	mocks.router.query.tab = 'sources'
	await render()
	expect(editor()).toBe(instructions)
	expect(instructions.value).toBe('Unsaved local draft')
	expect(container.querySelector<HTMLTextAreaElement>('textarea[placeholder="New chat in Research"]')!.value).toBe(
		'Unsent question'
	)
	expect(container.querySelector('[aria-label="Files search"]')).not.toBeNull()
	expect(container.querySelectorAll('[role="tabpanel"]:not([hidden])')).toHaveLength(1)
	expect(mocks.router.replace).not.toHaveBeenCalled()
	expect(mocks.updateProject).not.toHaveBeenCalled()
	await act(async () => instructions.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
	expect(mocks.updateProject).toHaveBeenCalledExactlyOnceWith({ custom_instructions: 'Unsaved local draft' })
	mocks.router.query.id = 'project-2'
	mocks.instructions = 'Another project'
	await render()
	expect(editor()).not.toBe(instructions)
	expect(editor().value).toBe('Another project')
})
