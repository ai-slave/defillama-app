import { afterEach, describe, expect, test, vi } from 'vitest'

/**
 * The URL path is the only record of whether the terminal is open. A reload and the Back button both
 * read it, so every way in or out has to write it, and every way between chats has to keep it.
 */

const router = vi.hoisted(() => ({
	replace: vi.fn(async () => true),
	push: vi.fn(async () => true)
}))
vi.mock('next/router', () => ({ default: router }))

const load = () => import('../terminalViewStore')

afterEach(async () => {
	const { setTerminalViewOpen } = await load()
	setTerminalViewOpen(false)
	router.replace.mockClear()
	router.push.mockClear()
	vi.unstubAllGlobals()
})

describe('moving between chats', () => {
	test('inside the terminal every chat route stays under the terminal path; outside it nothing changes', async () => {
		const { setTerminalViewOpen, withTerminalView } = await load()

		expect(withTerminalView('/ai/chat/next')).toBe('/ai/chat/next')
		setTerminalViewOpen(true, 'ETH')
		expect(withTerminalView('/ai/chat/next')).toBe('/ai/terminal/next')
		expect(withTerminalView('/ai/chat/next#msg-1')).toBe('/ai/terminal/next#msg-1')
		expect(withTerminalView('/ai/chat')).toBe('/ai/terminal')
		expect(withTerminalView('/ai/projects/p')).toBe('/ai/projects/p')
	})
})

describe('switching place from the sidebar', () => {
	test('Terminal and Chat each add a history entry, so Back returns to where the user was', async () => {
		const { leaveTerminalForChatHome, openTerminalHome } = await load()

		openTerminalHome()
		expect(router.push).toHaveBeenLastCalledWith('/ai/terminal')
		leaveTerminalForChatHome()
		expect(router.push).toHaveBeenLastCalledWith('/ai/chat')
		expect(router.replace).not.toHaveBeenCalled()
	})
})

describe('stored pane layout', () => {
	test('a stored open flag from before the URL owned it neither opens the terminal nor survives the next write', async () => {
		const storage = new Map<string, string>([
			['llamaai-terminal-view', JSON.stringify({ open: true, chatRatio: 0.4, chatCollapsed: true })]
		])
		vi.stubGlobal('localStorage', {
			getItem: (key: string) => storage.get(key) ?? null,
			setItem: (key: string, value: string) => storage.set(key, value)
		})
		const { getTerminalViewOpen, setTerminalChatRatio } = await load()

		expect(getTerminalViewOpen()).toBe(false)

		setTerminalChatRatio(0.5)
		expect(JSON.parse(storage.get('llamaai-terminal-view')!)).toEqual({ chatRatio: 0.5, chatCollapsed: true })
	})
})

describe('an explicit symbol request overrides a saved layout exactly once', () => {
	test('the request survives a widget effect torn down before its chart was ready, and ends once one was', async () => {
		const { peekRequestedTerminalSymbol, setTerminalViewOpen, settleRequestedTerminalSymbol } = await load()

		setTerminalViewOpen(true, 'AAVE')
		// Strict mode mounts the widget effect, tears it down before the chart is ready, and mounts it
		// again. A `?symbol=` link opened on the saved layout's symbol when the first run took the
		// request with it.
		expect(peekRequestedTerminalSymbol()).toBe('AAVE')
		expect(peekRequestedTerminalSymbol()).toBe('AAVE')
		settleRequestedTerminalSymbol('AAVE')
		// The widget is rebuilt on every theme change. A request that survived its chart would keep
		// forcing an old symbol over the one the saved layout restores.
		expect(peekRequestedTerminalSymbol()).toBeNull()

		setTerminalViewOpen(true, 'ETH')
		settleRequestedTerminalSymbol('AAVE')
		expect(peekRequestedTerminalSymbol()).toBe('ETH')
		settleRequestedTerminalSymbol('ETH')
	})
})
