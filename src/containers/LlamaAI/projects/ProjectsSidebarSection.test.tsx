// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AI_SERVER } from '~/constants'
import { LlamaAIChromeContext } from '~/containers/LlamaAI/chrome'
import { installSubscriberSession } from '~/utils/test/subscriberSession'
import { ProjectsSidebarSection } from './ProjectsSidebarSection'
import { PROJECTS_KEY } from './queryKeys'
import type { ProjectChatSession } from './types'

const push = vi.hoisted(() => vi.fn())
vi.mock('next/router', () => ({ useRouter: () => ({ push, query: {}, pathname: '/ai' }) }))
// Heavy dialogs this suite never opens.
vi.mock('./CreateProjectModal', () => ({ CreateProjectModal: () => null }))
vi.mock('./DeleteProjectModal', () => ({ DeleteProjectModal: () => null }))

const session = installSubscriberSession('user')
const hideSidebar = vi.fn()
const selectSession = vi.fn()
const chrome = {
	toggleSidebar: () => {},
	hideSidebar,
	toggleFullscreen: () => {},
	isFullscreen: false,
	fullscreenLocked: false,
	sidebarVisible: true,
	toggleDashboardPanel: () => {},
	isDashboardPanelOpen: false
}
const failure = () => Response.json({ error: 'Offline' }, { status: 503 })
let projectsReply: () => unknown
let sessionsReply: (projectId: string) => unknown
let isDrawer: boolean

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	hideSidebar.mockReset()
	selectSession.mockReset()
	push.mockReset()
	localStorage.setItem('llamaai:sidebar-projects-open', 'true')
	isDrawer = false
	vi.stubGlobal('matchMedia', (query: string) => ({
		matches: isDrawer && query === '(max-width: 1023px)',
		addEventListener: () => {},
		removeEventListener: () => {}
	}))
	projectsReply = () => ({ projects: [] })
	sessionsReply = () => ({ sessions: [] })
	session.client.setDefaultOptions({ queries: { retry: false } })
	session.serve({
		[`${AI_SERVER}/projects`]: (url: URL) => {
			const match = url.pathname.match(/^\/projects\/([^/]+)\/sessions$/)
			return match ? sessionsReply(match[1]) : projectsReply()
		}
	})
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
			<session.Wrapper>
				<LlamaAIChromeContext.Provider value={chrome}>
					<ProjectsSidebarSection
						currentProjectId={currentProjectId}
						currentSessionProjectId={currentSessionProjectId}
						onSessionSelect={selectSession}
						onDelete={async () => {}}
					/>
				</LlamaAIChromeContext.Provider>
			</session.Wrapper>
		)
	)
}
const until = (check: () => void) => vi.waitFor(check, { timeout: 1000 })
const projects = (...names: Array<[string, string]>) => ({ projects: names.map(([id, name]) => ({ id, name })) })
const button = (text: string) => [...container.querySelectorAll('button')].find((b) => b.textContent === text)!
const folder = (name: string) =>
	[...container.querySelectorAll<HTMLButtonElement>('button[aria-expanded]')].find((b) => b.textContent === name)!
const sessionRequests = (projectId: string) =>
	session.requests.filter(({ url }) => url.pathname === `/projects/${projectId}/sessions`).length

test('failed project queries differ from empty results and can retry', async () => {
	projectsReply = failure
	await render()
	await until(() => expect(container.textContent).toContain("Couldn't load projects"))
	expect(container.textContent).not.toContain('No projects yet')
	projectsReply = () => ({ projects: [] })
	await act(async () => container.querySelector<HTMLButtonElement>('[role="alert"] button')!.click())
	await until(() => expect(container.textContent).toContain('No projects yet'))
	expect(container.querySelector('[role="alert"]')).toBeNull()
})

test('a failed refresh retains projects and exposes nested chat failures separately', async () => {
	projectsReply = () => projects(['project', 'Research'])
	sessionsReply = failure
	await render()
	await until(() => expect(container.textContent).toContain("Couldn't load project chats"))
	projectsReply = failure
	await act(async () => session.client.refetchQueries({ queryKey: PROJECTS_KEY, exact: true }))
	await until(() => expect(container.textContent).toContain("Couldn't load projects"))
	expect(container.textContent).toContain('Research')
	const chatsError = [...container.querySelectorAll('[role="alert"]')].find((el) =>
		el.textContent?.includes('project chats')
	)!
	sessionsReply = () => ({ sessions: [] })
	await act(async () => chatsError.querySelector<HTMLButtonElement>('button')!.click())
	await until(() => expect(sessionRequests('project')).toBe(2))
})

test('the separate new-chat link opens the project and only closes the drawer for current-tab navigation', async () => {
	isDrawer = true
	projectsReply = () => projects(['project', 'Research'])
	await render()
	await until(() => expect(container.querySelector('a[href="/ai/projects/project"]')).not.toBeNull())
	const link = container.querySelector<HTMLAnchorElement>('a[href="/ai/projects/project"]')!
	expect(link.getAttribute('aria-label')).toBe('New chat in Research')
	expect(link.closest('button')).toBeNull()
	expect(container.querySelector('a[href="/ai/projects"]')).not.toBeNull()
	await act(async () => link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true })))
	expect(hideSidebar).not.toHaveBeenCalled()
	await act(async () => link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })))
	expect(hideSidebar).toHaveBeenCalledOnce()
})

test('folders toggle independently of the active chat and session clicks still select a conversation', async () => {
	isDrawer = true
	projectsReply = () => projects(['project', 'Research'], ['other', 'Other project'])
	const otherChat: ProjectChatSession = {
		sessionId: 'other-chat',
		title: 'Other conversation',
		createdAt: '2026-09-01',
		lastActivity: null,
		isPinned: false,
		pinnedAt: null,
		isPublic: false,
		shareToken: null
	}
	sessionsReply = (projectId) => ({ sessions: projectId === 'other' ? [otherChat] : [] })
	await render(null, 'project')
	await until(() => expect(folder('Research').getAttribute('aria-expanded')).toBe('true'))
	await act(async () => folder('Research').click())
	await until(() => expect(folder('Research').getAttribute('aria-expanded')).toBe('false'))
	await act(async () => folder('Other project').click())
	await until(() => expect(container.textContent).toContain('Other conversation'))
	expect(folder('Research').getAttribute('aria-expanded')).toBe('false')
	await render(null, 'project')
	expect(folder('Other project').getAttribute('aria-expanded')).toBe('true')
	expect(push).not.toHaveBeenCalled()
	expect(selectSession).not.toHaveBeenCalled()
	expect(hideSidebar).not.toHaveBeenCalled()
	const conversation = [...container.querySelectorAll<HTMLElement>('a, button')].find(
		(el) => el.textContent?.trim() === 'Other conversation'
	)!
	await act(async () => conversation.click())
	expect(selectSession).toHaveBeenCalledWith('other-chat')
	await act(async () => folder('Other project').click())
	await until(() => expect(container.textContent).not.toContain('Other conversation'))
	await render('other')
	await until(() => expect(folder('Other project').getAttribute('aria-expanded')).toBe('true'))
})

test('projects fold into one counted row that stays folded across renders until opened', async () => {
	localStorage.removeItem('llamaai:sidebar-projects-open')
	projectsReply = () => projects(['project', 'Research'], ['b', 'Other'])
	await render()
	const row = () => [...container.querySelectorAll('button')].find((b) => b.textContent?.startsWith('Projects'))!
	await until(() => expect(row().textContent).toBe('Projects2'))
	expect(row().getAttribute('aria-expanded')).toBe('false')
	expect(container.textContent).not.toContain('Research')
	expect(container.textContent).not.toContain('New project')

	await act(async () => row().click())
	await until(() => expect(container.textContent).toContain('Research'))
	expect(button('New project')).toBeDefined()
	await act(async () => root.unmount())
	root = createRoot(container)
	await render()
	expect(row().getAttribute('aria-expanded')).toBe('true')
	await until(() => expect(container.textContent).toContain('Research'))
})
