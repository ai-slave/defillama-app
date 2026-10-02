import { createContext, useContext } from 'react'
import { tw } from '~/ui/tw'

type LlamaAIChrome = {
	toggleSidebar: () => void
	hideSidebar: () => void
	toggleFullscreen: () => void
	isFullscreen: boolean
	fullscreenLocked: boolean
	sidebarVisible: boolean
	toggleDashboardPanel: () => void
	isDashboardPanelOpen: boolean
}

// The sidebar and chat row, signed in or out. On phones it ends at the top of the soft keyboard: iOS Safari
// keeps the layout viewport under it, and useKeyboardInset publishes the height it covers.
export const chatFrameStyles = tw`isolate flex flex-nowrap overflow-hidden max-lg:fixed max-lg:inset-x-0 max-lg:top-[68px] max-lg:bottom-(--keyboard-inset,0px) max-lg:z-10 max-lg:flex-col lg:relative lg:h-[calc(100dvh-32px)]`

export const LlamaAIChromeContext = createContext<LlamaAIChrome | null>(null)

export function useLlamaAIChrome() {
	const value = useContext(LlamaAIChromeContext)

	if (value === null) {
		throw new Error('LlamaAIChromeContext is missing')
	}

	return value
}
