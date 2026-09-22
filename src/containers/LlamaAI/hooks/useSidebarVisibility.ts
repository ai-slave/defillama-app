import { useCallback, useEffect, useState } from 'react'
import { TERMINAL_SITE_NAV_MIN_VIEWPORT_PX, useTerminalViewOpen } from '~/containers/LlamaAI/terminal/terminalViewStore'
import { useMedia } from '~/hooks/useMedia'
import {
	clearLlamaAIChromeAttributes,
	getLlamaAIBooleanCookie,
	LLAMAAI_FULLSCREEN_COOKIE_NAME,
	LLAMAAI_SIDEBAR_HIDDEN_COOKIE_NAME,
	setLlamaAICookie,
	syncLlamaAIChromeAttributes
} from '~/utils/cookies'

export function useSidebarVisibility() {
	const isMobile = useMedia('(max-width: 1023px)')
	const isTerminalViewOpen = useTerminalViewOpen()
	const isTooNarrowForTerminalSiteNav = useMedia(`(max-width: ${TERMINAL_SITE_NAV_MIN_VIEWPORT_PX - 1}px)`)
	const fullscreenLocked = isTerminalViewOpen && !isMobile && isTooNarrowForTerminalSiteNav
	const [sidebarHiddenDesktop, setSidebarHiddenDesktop] = useState(() => {
		if (typeof document === 'undefined') return true
		return getLlamaAIBooleanCookie(LLAMAAI_SIDEBAR_HIDDEN_COOKIE_NAME)
	})
	const [isFullscreen, setIsFullscreen] = useState(() => {
		if (typeof document === 'undefined') return false
		return getLlamaAIBooleanCookie(LLAMAAI_FULLSCREEN_COOKIE_NAME)
	})

	// Mobile: uses local state (no persistence needed)
	const [sidebarHiddenMobile, setSidebarHiddenMobile] = useState(true)

	const toggleSidebarMobile = useCallback(() => {
		setSidebarHiddenMobile((prev) => !prev)
	}, [])

	const toggleSidebarDesktop = useCallback(() => {
		setSidebarHiddenDesktop((prev) => {
			const next = !prev
			setLlamaAICookie(LLAMAAI_SIDEBAR_HIDDEN_COOKIE_NAME, next)
			return next
		})
	}, [])

	const hideSidebar = useCallback(() => {
		if (isMobile) {
			setSidebarHiddenMobile(true)
		} else {
			setSidebarHiddenDesktop(true)
			setLlamaAICookie(LLAMAAI_SIDEBAR_HIDDEN_COOKIE_NAME, true)
		}
	}, [isMobile])

	const toggleFullscreen = useCallback(() => {
		setIsFullscreen((prev) => {
			const next = !prev
			setLlamaAICookie(LLAMAAI_FULLSCREEN_COOKIE_NAME, next)
			return next
		})
	}, [])

	useEffect(() => {
		syncLlamaAIChromeAttributes(isFullscreen || fullscreenLocked, sidebarHiddenDesktop)
	}, [isFullscreen, fullscreenLocked, sidebarHiddenDesktop])

	useEffect(() => {
		return () => clearLlamaAIChromeAttributes()
	}, [])

	return {
		sidebarVisible: isMobile ? !sidebarHiddenMobile : !sidebarHiddenDesktop,
		toggleSidebar: isMobile ? toggleSidebarMobile : toggleSidebarDesktop,
		hideSidebar,
		isFullscreen,
		fullscreenLocked,
		toggleFullscreen
	}
}
