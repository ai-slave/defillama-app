// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ProjectsSidebarSection } from './ProjectsSidebarSection'
import type { ProjectWithStats } from './types'

const mocks = vi.hoisted(() => ({
	projects: {
		data: [] as Array<ProjectWithStats>,
		isLoading: false,
		isFetching: false,
		error: null as Error | null,
		refetch: vi.fn()
	},
	sessions: { data: [], isLoading: false, isFetching: false, error: null as Error | null, refetch: vi.fn() }
}))
vi.mock('./hooks', () => ({ useProjectList: () => mocks.projects, useProjectSessions: () => mocks.sessions }))
vi.mock('./CreateProjectModal', () => ({ CreateProjectModal: () => null }))
vi.mock('~/auth', () => ({
	useAuthContext: () => ({ user: { id: 'user' }, hasActiveSubscription: true, isTrial: false })
}))
vi.mock('~/containers/LlamaAI/chrome', () => ({ useLlamaAIChrome: () => ({ hideSidebar: vi.fn() }) }))
vi.mock('~/contexts/LlamaAINavigate', () => ({ useLlamaAINavigate: () => ({ toProject: vi.fn() }) }))
vi.mock('~/contexts/localStorageStore', () => ({ useStorageItem: () => null, setStorageItem: vi.fn() }))
vi.mock('~/hooks/useMedia', () => ({ useMedia: () => false }))
vi.mock('~/containers/LlamaAI/components/sidebar/AgenticSessionItem', () => ({ AgenticSessionItem: () => null }))
vi.mock('~/containers/LlamaAI/components/sidebar/AgenticSidebar', () => ({ SIDEBAR_ROW: '' }))
let root: Root
let container: HTMLDivElement
beforeEach(() => {
	vi.clearAllMocks()
	mocks.projects.data = []
	mocks.projects.error = null
	mocks.projects.isFetching = false
	mocks.sessions.error = null
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})
async function render() {
	await act(async () =>
		root.render(<ProjectsSidebarSection currentProjectId="project" onSessionSelect={vi.fn()} onDelete={vi.fn()} />)
	)
}

test('failed project queries differ from empty results and can retry', async () => {
	mocks.projects.error = new Error('Offline')
	await render()
	expect(container.textContent).toContain("Couldn't load projects")
	expect(container.textContent).not.toContain('No projects yet')
	await act(async () => container.querySelector<HTMLButtonElement>('[role="alert"] button')!.click())
	expect(mocks.projects.refetch).toHaveBeenCalledTimes(1)
	mocks.projects.isFetching = true
	await render()
	expect(container.querySelector<HTMLButtonElement>('[role="alert"] button')!.disabled).toBe(true)
	mocks.projects.error = null
	mocks.projects.isFetching = false
	await render()
	expect(container.textContent).toContain('No projects yet')
})
test('a failed refresh retains projects and exposes nested chat failures separately', async () => {
	mocks.projects.data = [{ id: 'project', name: 'Research' } as ProjectWithStats]
	mocks.projects.error = new Error('Offline')
	mocks.sessions.error = new Error('Offline')
	await render()
	expect(container.textContent).toContain('Research')
	const error = [...container.querySelectorAll('[role="alert"]')].find((el) =>
		el.textContent?.includes('project chats')
	)!
	await act(async () => error.querySelector<HTMLButtonElement>('button')!.click())
	expect(mocks.sessions.refetch).toHaveBeenCalledTimes(1)
})
