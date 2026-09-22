// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AgenticSidebar } from '../AgenticSidebar'

const mocks = vi.hoisted(() => ({
	toggleSidebar: vi.fn(),
	toggleFullscreen: vi.fn(),
	fullscreenLocked: false
}))
vi.mock('~/auth', () => ({
	useAuthContext: () => ({
		user: { id: 'user', flags: { is_llama: true } },
		authorizedFetch: vi.fn(),
		isAuthenticated: true,
		hasActiveSubscription: true
	})
}))
vi.mock('~/containers/LlamaAI/chrome', () => ({
	useLlamaAIChrome: () => ({
		hideSidebar: vi.fn(),
		toggleSidebar: mocks.toggleSidebar,
		toggleFullscreen: mocks.toggleFullscreen,
		isFullscreen: false,
		fullscreenLocked: mocks.fullscreenLocked
	})
}))
vi.mock('~/containers/Subscription/useTopup', () => ({ useAiBalance: () => ({ balance: null, totalAvailable: 0 }) }))
vi.mock('~/containers/LlamaAI/projects/ProjectsSidebarSection', () => ({
	ProjectsSidebarSection: () => null,
	SIDEBAR_PROJECTS_OPEN_KEY: 'projects-open'
}))
vi.mock('~/utils/analytics/umami', () => ({ trackUmamiEvent: vi.fn() }))

let root: Root
let container: HTMLDivElement
let client: QueryClient
beforeEach(() => {
	vi.clearAllMocks()
	mocks.fullscreenLocked = false
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

async function render(props: Partial<ComponentProps<typeof AgenticSidebar>>) {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
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
			</QueryClientProvider>
		)
	)
}

const destinations = () =>
	[
		...container.querySelectorAll<HTMLButtonElement>(
			'nav[aria-label="LlamaAI"] button, nav[aria-label="LlamaAI menu"] button'
		)
	].map((button) => ({
		label: (button.querySelector('.sr-only')?.textContent ?? button.textContent ?? '').replace(/\d+$|New$/, ''),
		current: button.getAttribute('aria-current')
	}))
const button = (label: string) =>
	[
		...container.querySelectorAll<HTMLButtonElement>(
			'nav[aria-label="LlamaAI"] button, nav[aria-label="LlamaAI menu"] button'
		)
	].find((b) => (b.querySelector('.sr-only')?.textContent ?? b.textContent)?.replace(/\d+$|New$/, '') === label)!

/**
 * Users were lost between two sidebars. The rail in the chat and the rail in the terminal must be the
 * same list, so the only thing that tells the two places apart is which one is marked current.
 */
test('the rail lists the same destinations in both places and marks only the place you are in', async () => {
	await render({ folded: true, place: 'chat' })
	const inChat = destinations()
	await render({ folded: true, place: 'terminal' })
	const inTerminal = destinations()

	expect(inChat.map((d) => d.label)).toEqual([
		'Open sidebar',
		'Search chats',
		'New chat',
		'Chat',
		'Terminal',
		'Alerts',
		'Projects',
		'Settings'
	])
	expect(inTerminal.map((d) => d.label)).toEqual(inChat.map((d) => d.label))
	expect(inChat.filter((d) => d.current === 'page').map((d) => d.label)).toEqual(['Chat'])
	expect(inTerminal.filter((d) => d.current === 'page').map((d) => d.label)).toEqual(['Terminal'])
})

test('the open sidebar marks the same place as its rail', async () => {
	await render({ place: 'chat' })
	expect(
		destinations()
			.filter((d) => d.current === 'page')
			.map((d) => d.label)
	).toEqual(['Chat'])
	await render({ place: 'terminal' })
	expect(
		destinations()
			.filter((d) => d.current === 'page')
			.map((d) => d.label)
	).toEqual(['Terminal'])
})

test('Chat leaves the terminal, Terminal leaves the chat, and the current place is not re-entered', async () => {
	const onSwitchPlace = vi.fn()
	await render({ folded: true, place: 'terminal', onSwitchPlace })
	await act(async () => button('Terminal').click())
	expect(onSwitchPlace).not.toHaveBeenCalled()
	await act(async () => button('Chat').click())
	expect(onSwitchPlace).toHaveBeenCalledOnce()

	onSwitchPlace.mockClear()
	await render({ place: 'chat', onSwitchPlace })
	await act(async () => button('Chat').click())
	expect(onSwitchPlace).not.toHaveBeenCalled()
	await act(async () => button('Terminal').click())
	expect(onSwitchPlace).toHaveBeenCalledOnce()
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
		(b.querySelector('.sr-only')?.textContent ?? '').endsWith('Fullscreen')
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
	expect(locked.querySelector('.sr-only')?.textContent).toBe('Exit Fullscreen')
	await act(async () => locked.click())
	expect(mocks.toggleFullscreen).not.toHaveBeenCalled()
})
