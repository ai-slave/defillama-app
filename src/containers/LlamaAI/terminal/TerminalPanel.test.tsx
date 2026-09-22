// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { TerminalPanel } from './TerminalPanel'

const mocks = vi.hoisted(() => ({
	authorizedFetch: vi.fn(),
	runIndicators: vi.fn(),
	authListeners: new Set<() => void>(),
	session: { userId: 'account-a', layout: null, controller: new AbortController() }
}))

vi.mock('~/auth', () => ({
	useAuthContext: () => ({ authorizedFetch: mocks.authorizedFetch, user: { id: 'account-a' } })
}))
vi.mock('~/auth/authStore', () => ({
	subscribeToAuthStore: (listener: () => void) => {
		mocks.authListeners.add(listener)
		return () => {
			mocks.authListeners.delete(listener)
		}
	}
}))
vi.mock('~/components/ECharts/shared/chartTheme', () => ({ getChartTheme: () => ({}) }))
vi.mock('~/contexts/LocalStorage', () => ({ useDarkModeManager: () => [false] }))
vi.mock('~/hooks/useDebounce', () => ({ useDebouncedCallback: () => mocks.runIndicators }))
vi.mock('./TerminalMarketStrip', () => ({ TerminalMarketStrip: () => null }))
vi.mock('./terminalChatState', () => ({ scheduleTerminalChatSave: vi.fn() }))
vi.mock('./terminalIndicators', () => ({ runTerminalIndicators: vi.fn() }))
vi.mock('./terminalLayers', () => ({ mountTerminalLayerControls: vi.fn() }))
vi.mock('./terminalSocket', () => ({ releaseTerminalBars: vi.fn() }))
vi.mock('./terminalOps', () => ({}))
vi.mock('./terminalLayout', () => ({
	getTerminalLayoutSession: () => mocks.session,
	fetchTerminalLayout: async () => null,
	startTerminalLayoutAutoSave: vi.fn()
}))
vi.mock('./terminalData', () => ({
	loadTerminalScript: async () => {},
	createTerminalDatafeed: async () => ({}),
	createTerminalStudies: () => async () => [],
	fetchTerminalEntities: async () => ({}),
	defaultEntityFor: () => null,
	setCurrentTerminalEntity: vi.fn(),
	STUDY_NAME: 'DefiLlama'
}))
vi.mock('./terminalViewStore', () => ({
	useTerminalSymbol: () => 'ETH',
	getTerminalSymbol: () => 'ETH',
	peekRequestedTerminalSymbol: () => null,
	setTerminalWidget: vi.fn()
}))

let root: ReturnType<typeof createRoot> | null = null

beforeEach(() => {
	mocks.authListeners.clear()
	mocks.session = { userId: 'account-a', layout: null, controller: new AbortController() }
})

afterEach(async () => {
	await act(() => root?.unmount())
	root = null
	delete window.TradingView
})

test('same-account reauthentication rebuilds the widget, while a valid session refresh preserves it', async () => {
	const created = vi.fn()
	const removed = vi.fn()
	class Widget {
		constructor() {
			created()
		}
		onChartReady() {}
		remove() {
			removed()
		}
	}
	window.TradingView = { widget: Widget as unknown as NonNullable<Window['TradingView']>['widget'] }
	root = createRoot(document.createElement('div'))
	await act(async () => {
		root!.render(<TerminalPanel />)
	})
	await act(async () => {
		root!.render(<TerminalPanel />)
	})
	expect(created).toHaveBeenCalledTimes(1)
	expect(removed).not.toHaveBeenCalled()

	await act(async () => {
		mocks.session.controller.abort()
		mocks.session = { userId: 'account-a', layout: null, controller: new AbortController() }
		for (const listener of mocks.authListeners) listener()
	})
	expect(created).toHaveBeenCalledTimes(2)
	expect(removed).toHaveBeenCalledTimes(1)
})
