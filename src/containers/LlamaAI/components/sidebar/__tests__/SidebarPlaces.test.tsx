// @vitest-environment happy-dom
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { LlamaAIChromeContext } from '~/containers/LlamaAI/chrome'
import pb from '~/utils/pocketbase'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { AgenticSidebar } from '../AgenticSidebar'

const mocks = { toggleSidebar: vi.fn(), toggleFullscreen: vi.fn(), fullscreenLocked: false }
const session = installSubscriberSession('user')
// Heavy child these tests do not read.
vi.mock('~/containers/LlamaAI/projects/ProjectsSidebarSection', () => ({
	ProjectsSidebarSection: () => null,
	SIDEBAR_PROJECTS_OPEN_KEY: 'projects-open'
}))

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	mocks.toggleSidebar.mockReset()
	mocks.toggleFullscreen.mockReset()
	mocks.fullscreenLocked = false
	// The terminal place exists only for llama accounts.
	const record = { ...pb.authStore.record!, flags: { is_llama: true } }
	pb.authStore.save(pb.authStore.token, record)
	session.serve({
		'/api/collections/users/auth-refresh': { token: pb.authStore.token, record },
		'https://features.llama.fi/user/ai-balance': {
			freeRemaining: '0',
			toppedUpBalance: '0',
			freeLimit: '1',
			freeSpent: '1'
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

async function render(props: Partial<ComponentProps<typeof AgenticSidebar>>) {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<LlamaAIChromeContext.Provider
					value={{
						hideSidebar: () => {},
						toggleSidebar: mocks.toggleSidebar,
						toggleFullscreen: mocks.toggleFullscreen,
						isFullscreen: false,
						fullscreenLocked: mocks.fullscreenLocked,
						sidebarVisible: true,
						toggleDashboardPanel: () => {},
						isDashboardPanelOpen: false
					}}
				>
					<AgenticSidebar
						sessions={[]}
						isLoading={false}
						currentSessionId={null}
						restoringSessionId={null}
						onSessionSelect={vi.fn()}
						onNewChat={vi.fn()}
						onDelete={async () => {}}
						onOpenAlerts={vi.fn()}
						alertsCount={3}
						onOpenSettings={vi.fn()}
						{...props}
					/>
				</LlamaAIChromeContext.Provider>
			</session.Wrapper>
		)
	)
}

const destinations = () =>
	[
		...container.querySelectorAll<HTMLButtonElement>(
			'nav[aria-label="LlamaAI"] button, nav[aria-label="LlamaAI menu"] button'
		)
	].map((button) => ({
		label: (button.querySelector('.sr-only')?.textContent ?? button.textContent ?? '').replace(/\d+$|New$/, '')
	}))
const button = (label: string) =>
	[
		...container.querySelectorAll<HTMLButtonElement>(
			'nav[aria-label="LlamaAI"] button, nav[aria-label="LlamaAI menu"] button'
		)
	].find((b) => (b.querySelector('.sr-only')?.textContent ?? b.textContent)?.replace(/\d+$|New$/, '') === label)!

const viewSwitch = () => container.querySelector('[role="radiogroup"][aria-label="View"]')
// The rail's options are icons named by aria-label; the open sidebar's are text.
const optionName = (radio: HTMLInputElement) =>
	radio.getAttribute('aria-label') ?? radio.closest('label')!.textContent!.replace(/New$/, '')
const viewRadios = () => [
	...container.querySelectorAll<HTMLInputElement>('[role="radiogroup"][aria-label="View"] input[type="radio"]')
]
const viewOptions = () => viewRadios().map((radio) => ({ label: optionName(radio), checked: radio.checked }))
const viewOption = (label: string) =>
	viewRadios()
		.find((radio) => optionName(radio) === label)!
		.closest('label')!

/**
 * Users were lost between two sidebars. The rail in the chat and the rail in the terminal must be the
 * same list, so the only thing that tells the two places apart is which View option is selected.
 */
test('the rail lists the same destinations in both places', async () => {
	await render({ folded: true, place: 'chat' })
	const inChat = destinations().map((d) => d.label)
	await render({ folded: true, place: 'terminal' })
	expect(inChat).toEqual(['Open sidebar', 'Search chats', 'New chat', 'Alerts', 'Projects', 'Settings'])
	expect(destinations().map((d) => d.label)).toEqual(inChat)
})

test('the rail and the open sidebar show one View switch set to the place you are in', async () => {
	for (const folded of [true, false]) {
		await render({ folded, place: 'chat' })
		expect(viewOptions()).toEqual([
			{ label: 'Chat', checked: true },
			{ label: 'Terminal', checked: false }
		])
		await render({ folded, place: 'terminal' })
		expect(viewOptions()).toEqual([
			{ label: 'Chat', checked: false },
			{ label: 'Terminal', checked: true }
		])
	}
})

test('Chat leaves the terminal, Terminal leaves the chat, and the current place is not re-entered', async () => {
	const onSwitchPlace = vi.fn()
	await render({ folded: true, place: 'terminal', onSwitchPlace })
	await act(async () => viewOption('Terminal').click())
	expect(onSwitchPlace).not.toHaveBeenCalled()
	await act(async () => viewOption('Chat').click())
	expect(onSwitchPlace).toHaveBeenCalledOnce()

	onSwitchPlace.mockClear()
	await render({ place: 'chat', onSwitchPlace })
	await act(async () => viewOption('Chat').click())
	expect(onSwitchPlace).not.toHaveBeenCalled()
	await act(async () => viewOption('Terminal').click())
	expect(onSwitchPlace).toHaveBeenCalledOnce()
})

/** Without the terminal there is one place, so a Chat entry beside New chat only reads as a second New chat. */
test('an account without the terminal sees no View switch in the rail or the open sidebar', async () => {
	const record = { ...pb.authStore.record!, flags: {} }
	pb.authStore.save(pb.authStore.token, record)
	session.serve({ '/api/collections/users/auth-refresh': { token: pb.authStore.token, record } })

	await render({ folded: true, place: 'chat' })
	expect(viewSwitch()).toBeNull()
	await render({ place: 'chat' })
	expect(viewSwitch()).toBeNull()
	expect(destinations().map((d) => d.label)).toEqual(['New chat'])
})

test('the rail search opens the sidebar with the search field showing', async () => {
	const onSearchOpenChange = vi.fn()
	await render({ folded: true, onSearchOpenChange })
	await act(async () => button('Search chats').click())
	expect(onSearchOpenChange).toHaveBeenCalledWith(true)
	expect(mocks.toggleSidebar).toHaveBeenCalledOnce()

	await render({ searchOpen: false, onSearchOpenChange })
	expect(container.querySelector('[aria-label="Search sessions"]')).toBeNull()
	await render({ searchOpen: true, onSearchOpenChange })
	expect(container.querySelector('[aria-label="Search sessions"]')).not.toBeNull()
})

const fullscreenButton = () =>
	[...container.querySelectorAll<HTMLButtonElement>('header button')].find((b) =>
		(b.querySelector('.sr-only')?.textContent ?? '').endsWith('fullscreen')
	)

/** The site menu choice is one setting for the whole product, so it is reachable from both places. */
test('the open sidebar has the same fullscreen button in chat and in the terminal', async () => {
	for (const place of ['chat', 'terminal'] as const) {
		await render({ place })
		await act(async () => fullscreenButton()!.click())
	}
	expect(mocks.toggleFullscreen).toHaveBeenCalledTimes(2)
})

/** A window too narrow for the menu beside the chart: the button stays visible but explains itself. */
test('when the window forces fullscreen, the button shows it and cannot turn it off', async () => {
	mocks.fullscreenLocked = true
	await render({ place: 'terminal' })
	const locked = fullscreenButton()!
	expect(locked.getAttribute('aria-disabled')).toBe('true')
	expect(locked.querySelector('.sr-only')?.textContent).toBe('Exit fullscreen')
	await act(async () => locked.click())
	expect(mocks.toggleFullscreen).not.toHaveBeenCalled()
})
