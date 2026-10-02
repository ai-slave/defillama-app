// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { LlamaAIChromeContext } from '~/containers/LlamaAI/chrome'
import { accessibleName } from '~/utils/testing/accessibleName'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { AgenticSidebar } from '../AgenticSidebar'

const session = installSubscriberSession('user')
// Heavy child these tests do not read.
vi.mock('~/containers/LlamaAI/projects/ProjectsSidebarSection', () => ({
	ProjectsSidebarSection: () => null,
	SIDEBAR_PROJECTS_OPEN_KEY: 'projects-open'
}))

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	session.serve({
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

function Harness() {
	const [searchOpen, setSearchOpen] = useState(true)
	return (
		<session.Wrapper>
			<LlamaAIChromeContext.Provider
				value={{
					hideSidebar: () => {},
					toggleSidebar: () => {},
					toggleFullscreen: () => {},
					isFullscreen: false,
					fullscreenLocked: false,
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
					onSessionSelect={() => {}}
					onNewChat={() => {}}
					onDelete={async () => {}}
					alertsCount={null}
					searchOpen={searchOpen}
					onSearchOpenChange={setSearchOpen}
				/>
			</LlamaAIChromeContext.Provider>
		</session.Wrapper>
	)
}
const control = (name: string) =>
	[...container.querySelectorAll<HTMLElement>('button, input')].find((element) => accessibleName(element) === name)

test.each([
	[
		'the clear button',
		() => {
			const clear = control('Clear session search')!
			clear.focus()
			clear.click()
		}
	],
	[
		'Escape',
		() => {
			const field = control('Search sessions')!
			field.focus()
			field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
		}
	]
])('closing session search with %s returns focus to the search toggle', async (_how, close) => {
	await act(async () => root.render(<Harness />))
	await act(async () => close())
	expect(control('Search sessions')).toBeUndefined()
	expect(document.activeElement).toBe(control('Search chats'))
})
