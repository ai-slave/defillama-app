// @vitest-environment happy-dom
// @vitest-environment-options {"url":"http://localhost/ai/chat"}
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { setTerminalViewOpen, TERMINAL_SITE_NAV_MIN_VIEWPORT_PX } from '../terminal/terminalViewStore'
import { useSidebarVisibility } from './useSidebarVisibility'

// happy-dom evaluates media queries against its viewport and fires their change events on resize.
const setViewport = (width: number) =>
	(
		window as unknown as { happyDOM: { setViewport: (size: { width: number; height: number }) => void } }
	).happyDOM.setViewport({ width, height: 900 })
const resize = async (width: number) => {
	await act(async () => setViewport(width))
}
const siteNavHidden = () => document.documentElement.getAttribute('data-llamaai-fullscreen') === 'true'

let root: Root
let container: HTMLDivElement
let chrome: ReturnType<typeof useSidebarVisibility>
function Probe() {
	chrome = useSidebarVisibility()
	return null
}
const mount = async () => {
	root = createRoot(container)
	await act(async () => root.render(<Probe />))
}
beforeEach(() => {
	document.cookie = 'llamaai-sidebar-hidden=; max-age=0; path=/'
	document.cookie = 'llamaai-fullscreen=; max-age=0; path=/'
	setViewport(1680)
	container = document.createElement('div')
	document.body.append(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	setTerminalViewOpen(false)
	container.remove()
})

/** Normal chat opens with the sidebar, and a user who folded it to the rail finds it folded next visit. */
test('the sidebar starts open and remembers being folded or unfolded across page loads', async () => {
	await mount()
	expect(chrome.sidebarVisible).toBe(true)

	await act(async () => chrome.toggleSidebar())
	expect(chrome.sidebarVisible).toBe(false)
	await act(async () => root.unmount())
	await mount()
	expect(chrome.sidebarVisible).toBe(false)

	await act(async () => chrome.toggleSidebar())
	await act(async () => root.unmount())
	await mount()
	expect(chrome.sidebarVisible).toBe(true)
})

/** Chat and terminal are one product: the site menu choice made in one place is what the other shows. */
test('one fullscreen choice hides or shows the site menu in both chat and terminal, and survives a reload', async () => {
	await mount()
	expect(siteNavHidden()).toBe(false)

	await act(async () => setTerminalViewOpen(true))
	expect(siteNavHidden()).toBe(false)
	await act(async () => chrome.toggleFullscreen())
	expect(siteNavHidden()).toBe(true)

	await act(async () => setTerminalViewOpen(false))
	expect(chrome.isFullscreen).toBe(true)
	expect(siteNavHidden()).toBe(true)

	await act(async () => root.unmount())
	await mount()
	expect(siteNavHidden()).toBe(true)
	await act(async () => chrome.toggleFullscreen())
	await act(async () => setTerminalViewOpen(true))
	expect(siteNavHidden()).toBe(false)
})

/**
 * Beside the site menu the terminal needs rail + a chart wide enough for its one-row header + the
 * narrowest chat. Below that the chart would wrap, so the terminal hides the menu and says why,
 * without changing the saved choice that chat still follows.
 */
test('a window too narrow for the site menu keeps the terminal fullscreen until it is wide enough again', async () => {
	await mount()
	await act(async () => setTerminalViewOpen(true))

	await resize(TERMINAL_SITE_NAV_MIN_VIEWPORT_PX)
	expect(chrome.fullscreenLocked).toBe(false)
	expect(siteNavHidden()).toBe(false)

	await resize(TERMINAL_SITE_NAV_MIN_VIEWPORT_PX - 1)
	expect(chrome.fullscreenLocked).toBe(true)
	expect(chrome.isFullscreen).toBe(false)
	expect(siteNavHidden()).toBe(true)

	await act(async () => setTerminalViewOpen(false))
	expect(chrome.fullscreenLocked).toBe(false)
	expect(siteNavHidden()).toBe(false)

	await act(async () => setTerminalViewOpen(true))
	await resize(TERMINAL_SITE_NAV_MIN_VIEWPORT_PX + 200)
	expect(chrome.fullscreenLocked).toBe(false)
	expect(siteNavHidden()).toBe(false)
})

/** On a phone there is no chart beside the chat, so there is nothing to make room for. */
test('a phone with the terminal open keeps the saved site menu choice', async () => {
	await mount()
	await act(async () => setTerminalViewOpen(true))
	await resize(800)
	expect(chrome.fullscreenLocked).toBe(false)
	expect(siteNavHidden()).toBe(false)
})
