// @vitest-environment happy-dom
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { AgenticSessionItem } from '~/containers/LlamaAI/components/sidebar/AgenticSessionItem'
import { ProjectsSidebarSection } from './ProjectsSidebarSection'
import type { ProjectChatSession, ProjectWithStats } from './types'

const mocks = vi.hoisted(() => ({
	isDrawer: false,
	hideSidebar: vi.fn(),
	push: vi.fn(),
	selectSession: vi.fn(),
	sessionsByProject: {} as Record<string, Array<ProjectChatSession>>,
	projects: {
		data: [] as Array<ProjectWithStats>,
		isLoading: false,
		isFetching: false,
		error: null as Error | null,
		refetch: vi.fn()
	},
	sessions: { data: [], isLoading: false, isFetching: false, error: null as Error | null, refetch: vi.fn() }
}))
vi.mock('./hooks', () => ({
	useProjectList: () => mocks.projects,
	useProjectSessions: (id: string | null) => ({ ...mocks.sessions, data: id ? mocks.sessionsByProject[id] : undefined })
}))
vi.mock('./CreateProjectModal', () => ({ CreateProjectModal: () => null }))
vi.mock('./DeleteProjectModal', () => ({ DeleteProjectModal: () => null }))
vi.mock('~/auth', () => ({
	useAuthContext: () => ({ user: { id: 'user' }, hasActiveSubscription: true, isTrial: false })
}))
vi.mock('~/containers/LlamaAI/chrome', () => ({ useLlamaAIChrome: () => ({ hideSidebar: mocks.hideSidebar }) }))
vi.mock('next/router', () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock('~/hooks/useMedia', () => ({ useMedia: () => mocks.isDrawer }))
vi.mock('~/containers/LlamaAI/components/sidebar/AgenticSessionItem', () => ({
	AgenticSessionItem: ({ session, onSessionSelect }: ComponentProps<typeof AgenticSessionItem>) => (
		<button type="button" onClick={() => onSessionSelect(session.sessionId)}>
			{session.title}
		</button>
	)
}))
vi.mock('~/containers/LlamaAI/components/sidebar/AgenticSidebar', () => ({ SIDEBAR_ROW: '', SIDEBAR_ROW_SURFACE: '' }))
let root: Root
let container: HTMLDivElement
beforeEach(() => {
	vi.clearAllMocks()
	localStorage.clear()
	mocks.sessionsByProject = {}
	mocks.isDrawer = false
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
async function render(currentProjectId: string | null = 'project', currentSessionProjectId: string | null = null) {
	await act(async () =>
		root.render(
			<ProjectsSidebarSection
				currentProjectId={currentProjectId}
				currentSessionProjectId={currentSessionProjectId}
				onSessionSelect={mocks.selectSession}
				onDelete={vi.fn()}
			/>
		)
	)
}

async function waitFor(check: () => void) {
	await act(async () => {
		await vi.waitFor(check)
	})
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
	await waitFor(() => expect(container.textContent).toContain("Couldn't load project chats"))
	expect(container.textContent).toContain('Research')
	const error = [...container.querySelectorAll('[role="alert"]')].find((el) =>
		el.textContent?.includes('project chats')
	)!
	await act(async () => error.querySelector<HTMLButtonElement>('button')!.click())
	expect(mocks.sessions.refetch).toHaveBeenCalledTimes(1)
})

test('the separate new-chat link opens the project and only closes the drawer for current-tab navigation', async () => {
	mocks.isDrawer = true
	mocks.projects.data = [{ id: 'project', name: 'Research' } as ProjectWithStats]
	await render()
	const link = container.querySelector<HTMLAnchorElement>('a[href="/ai/projects/project"]')!
	expect(link.getAttribute('aria-label')).toBe('New chat in Research')
	expect(link.closest('button')).toBeNull()
	expect(container.querySelector('a[href="/ai/projects"]')).not.toBeNull()
	await act(async () => link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true })))
	expect(mocks.hideSidebar).not.toHaveBeenCalled()
	await act(async () => link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })))
	expect(mocks.hideSidebar).toHaveBeenCalledOnce()
})

test('folders toggle independently of the active chat and session clicks still select a conversation', async () => {
	mocks.isDrawer = true
	mocks.projects.data = [
		{ id: 'project', name: 'Research' } as ProjectWithStats,
		{ id: 'other', name: 'Other project' } as ProjectWithStats
	]
	mocks.sessionsByProject.other = [
		{
			sessionId: 'other-chat',
			title: 'Other conversation',
			createdAt: '2026-09-01',
			lastActivity: null,
			isPinned: false,
			pinnedAt: null,
			isPublic: false,
			shareToken: null
		}
	]
	await render(null, 'project')
	const folder = (name: string) =>
		[...container.querySelectorAll<HTMLButtonElement>('button[aria-expanded]')].find(
			(button) => button.textContent === name
		)!
	await waitFor(() => expect(folder('Research').getAttribute('aria-expanded')).toBe('true'))
	await act(async () => folder('Research').click())
	await waitFor(() => expect(folder('Research').getAttribute('aria-expanded')).toBe('false'))
	await act(async () => folder('Other project').click())
	await waitFor(() => expect(container.textContent).toContain('Other conversation'))
	expect(folder('Research').getAttribute('aria-expanded')).toBe('false')
	await render(null, 'project')
	expect(folder('Other project').getAttribute('aria-expanded')).toBe('true')
	expect(mocks.push).not.toHaveBeenCalled()
	expect(mocks.selectSession).not.toHaveBeenCalled()
	expect(mocks.hideSidebar).not.toHaveBeenCalled()
	await act(async () =>
		[...container.querySelectorAll('button')].find((button) => button.textContent === 'Other conversation')!.click()
	)
	expect(mocks.selectSession).toHaveBeenCalledWith('other-chat')
	await act(async () => folder('Other project').click())
	await waitFor(() => expect(container.textContent).not.toContain('Other conversation'))
	await render('other')
	await waitFor(() => expect(folder('Other project').getAttribute('aria-expanded')).toBe('true'))
})
