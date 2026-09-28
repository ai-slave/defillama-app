// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import toast from 'react-hot-toast'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { waitForUi } from '~/utils/testing/waitForUi'
import { EmbedSnippetDialog } from '../EmbedSnippetDialog'

vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }))

const writeText = vi.fn()
let root: Root
let container: HTMLDivElement

beforeEach(async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	vi.clearAllMocks()
	Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	await act(async () =>
		root.render(
			<EmbedSnippetDialog open onClose={() => {}} heading="Embed card" snippetFor={(theme) => `<iframe ${theme}>`} />
		)
	)
})

afterEach(async () => {
	vi.useRealTimers()
	await act(async () => root.unmount())
	container.remove()
})

function copyButton() {
	return Array.from(document.body.querySelectorAll('button')).find((node) =>
		['Copy code', 'Copied'].includes(node.textContent?.trim() ?? '')
	)!
}

test('copying the code confirms on the button for two seconds instead of a toast', async () => {
	writeText.mockResolvedValue(undefined)
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
	await act(async () => copyButton().click())
	expect(writeText).toHaveBeenCalledExactlyOnceWith('<iframe dark>')
	expect(copyButton().textContent).toBe('Copied')
	expect(toast.success).not.toHaveBeenCalled()
	await act(async () => vi.advanceTimersByTime(2000))
	expect(copyButton().textContent).toBe('Copy code')
})

test('a failed copy explains itself inside the dialog instead of a toast', async () => {
	writeText.mockRejectedValue(new Error('Denied'))
	await act(async () => copyButton().click())
	await waitForUi(() =>
		expect(document.body.querySelector('[role="alert"]')?.textContent).toBe(
			'Could not copy to clipboard. Select the code and copy it manually.'
		)
	)
	expect(copyButton().textContent).toBe('Copy code')
	expect(toast.error).not.toHaveBeenCalled()
})
