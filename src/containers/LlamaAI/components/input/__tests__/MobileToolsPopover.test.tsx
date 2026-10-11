// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { tabTo } from '~/utils/testing/keyboard'
import { waitForUi } from '~/utils/testing/waitForUi'
import { MobileToolsPopover } from '../MobileToolsPopover'

// Heavy child; these tests only need a prompt to pick.
vi.mock('../CapabilityBrowser', () => ({
	BrowserContent: ({ onPromptSelect }: { onPromptSelect: (prompt: string) => void }) => (
		<button type="button" onClick={() => onPromptSelect('Example prompt')}>
			Example prompt
		</button>
	)
}))

let root: Root
let container: HTMLDivElement
const promptSelected = vi.fn()

beforeEach(() => {
	vi.clearAllMocks()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

const button = (label: string) => document.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)
const exploreDrawer = () => document.querySelector('[aria-label="Explore AI capabilities"]')
const menuItem = (text: string) =>
	[...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((el) => el.textContent === text)

async function click(el: HTMLElement) {
	await act(async () => el.click())
}

async function openExplore() {
	await click(button('Open mobile tools')!)
	await waitForUi(() => expect(menuItem('Explore')).toBeTruthy())
	await click(menuItem('Explore')!)
	await waitForUi(() => expect(button('Back to mobile tools')).not.toBeNull())
}

async function reopenTools() {
	await waitForUi(() => expect(menuItem('Upload files')).toBeUndefined())
	await click(button('Open mobile tools')!)
	await waitForUi(() => expect(menuItem('Upload files')).toBeTruthy())
}

test.each([
	['closing with ×', () => click(button('Close mobile tools')!)],
	[
		'picking a prompt',
		() =>
			click([...document.querySelectorAll<HTMLElement>('button')].find((el) => el.textContent === 'Example prompt')!)
	]
])('reopening mobile tools after %s shows the tools menu, not Explore', async (_, close) => {
	await act(async () =>
		root.render(
			<MobileToolsPopover
				mode="quick"
				setMode={vi.fn()}
				isPending={false}
				onPromptSelect={promptSelected}
				onImageUploadClick={vi.fn()}
			/>
		)
	)
	await openExplore()
	await close()
	await reopenTools()
	expect(exploreDrawer()).toBeNull()
})

test('back from Explore returns to the tools menu', async () => {
	await act(async () =>
		root.render(
			<MobileToolsPopover
				mode="quick"
				setMode={vi.fn()}
				isPending={false}
				onPromptSelect={promptSelected}
				onImageUploadClick={vi.fn()}
			/>
		)
	)
	await openExplore()
	await click(button('Back to mobile tools')!)
	await waitForUi(() => expect(exploreDrawer()).toBeNull())
	expect(menuItem('Upload files')).toBeTruthy()
})

async function press(key: string) {
	const element = document.activeElement as HTMLElement
	await act(async () => {
		const down = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
		element.dispatchEvent(down)
		if (key === 'Enter' && !down.defaultPrevented && element instanceof HTMLButtonElement) element.click()
		element.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }))
		await new Promise((resolve) => setTimeout(resolve, 30))
	})
}

test('Explore opened by keyboard starts on its back button with its tooltip closed, and one Escape goes back', async () => {
	await act(async () =>
		root.render(
			<MobileToolsPopover
				mode="quick"
				setMode={vi.fn()}
				isPending={false}
				onPromptSelect={promptSelected}
				onImageUploadClick={vi.fn()}
			/>
		)
	)
	await tabTo(button('Open mobile tools')!)
	await press('Enter')
	await waitForUi(() => expect(document.activeElement?.getAttribute('role')).toBe('menuitem'))
	await act(async () => menuItem('Explore')!.focus())
	await press('Enter')
	await waitForUi(() => expect(document.activeElement).toBe(button('Back to mobile tools')))
	expect(document.querySelector('[role="tooltip"]')).toBeNull()
	await press('Escape')
	await waitForUi(() => expect(exploreDrawer()).toBeNull())
	// One level back: the tools menu stays open on the Explore row.
	expect(document.activeElement).toBe(menuItem('Explore'))
	expect(menuItem('Explore')!.getAttribute('aria-expanded')).toBe('false')
})
