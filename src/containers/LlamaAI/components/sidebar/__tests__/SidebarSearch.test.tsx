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

test('Escape in session search closes it and returns focus to the search toggle', async () => {
	await act(async () => root.render(<Harness />))
	await act(async () => {
		const field = control('Search sessions')!
		field.focus()
		field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
	})
	expect(control('Search sessions')).toBeUndefined()
	expect(document.activeElement).toBe(control('Search chats'))
})

test('the clear button empties session search and keeps it open with focus in the field', async () => {
	await act(async () => root.render(<Harness />))
	const field = control('Search sessions') as HTMLInputElement
	await act(async () => {
		field.focus()
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, 'gas fees')
		field.dispatchEvent(new Event('input', { bubbles: true }))
	})
	await act(async () => {
		const clear = control('Clear search')!
		clear.focus()
		clear.click()
	})
	expect(control('Search sessions')).toBe(field)
	expect(field.value).toBe('')
	expect(document.activeElement).toBe(field)
})
