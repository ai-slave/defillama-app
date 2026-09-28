// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
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
