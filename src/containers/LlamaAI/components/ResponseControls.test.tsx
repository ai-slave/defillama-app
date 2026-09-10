// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ResponseControls } from './ResponseControls'

vi.mock('~/containers/LlamaAI/components/AddToArticle/useArticleExport', () => ({ useArticleExport: () => vi.fn() }))
vi.mock('~/containers/LlamaAI/components/FeedbackForm', () => ({ FeedbackForm: () => null }))
vi.mock('~/containers/LlamaAI/components/PDFExportButton', () => ({ PDFExportButton: () => null }))
vi.mock('~/contexts/LocalStorage', () => ({ useDarkModeManager: () => [false] }))
vi.mock('~/utils/analytics/umami', () => ({ trackUmamiEvent: vi.fn() }))
vi.mock('~/containers/LlamaAI/utils/copyChartCapture', () => ({ captureChartImage: vi.fn() }))
vi.mock('~/containers/LlamaAI/utils/copyMessage', () => ({
	buildCopyMarkdown: vi.fn(async () => 'Markdown'),
	buildCopyHtml: vi.fn(async () => '<p>HTML</p>'),
	withFetchCache: (fn: object) => fn
}))
let root: Root
let container: HTMLDivElement
const writeText = vi.fn<(text: string) => Promise<void>>()
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
beforeEach(async () => {
	vi.clearAllMocks()
	Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
	vi.stubGlobal('ClipboardItem', undefined)
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	await act(async () => root.render(<ResponseControls messageId="message" content="Response" readOnly />))
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.unstubAllGlobals()
	if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard)
	else Reflect.deleteProperty(navigator, 'clipboard')
})
function copyButton() {
	return container.querySelector<HTMLButtonElement>('button')!
}

test('pending copy is named, announced and blocks duplicate clicks until success', async () => {
	let finish!: () => void
	writeText.mockImplementation(
		() =>
			new Promise<void>((resolve) => {
				finish = resolve
			})
	)
	const button = copyButton()
	await act(async () => button.click())
	expect(button.disabled).toBe(true)
	expect(button.getAttribute('aria-label')).toBe('Copying…')
	expect(container.querySelector('[role="status"]')?.textContent).toBe('Copying response…')
	await act(async () => button.click())
	expect(writeText).toHaveBeenCalledExactlyOnceWith('Markdown')
	await act(async () => finish())
	expect(button.disabled).toBe(false)
	expect(button.getAttribute('aria-label')).toBe('Copied')
	expect(container.querySelector('[role="status"]')?.textContent).toBe('Response copied')
})

test('clipboard failure is visible and the same control retries successfully', async () => {
	writeText.mockRejectedValue(new Error('Clipboard denied'))
	await act(async () => copyButton().click())
	expect(container.querySelector('[role="alert"]')?.textContent).toContain("Couldn't copy")
	expect(copyButton().disabled).toBe(false)
	expect(copyButton().getAttribute('aria-label')).toBe('Retry copy')
	writeText.mockResolvedValue(undefined)
	await act(async () => copyButton().click())
	expect(container.querySelector('[role="alert"]')).toBeNull()
	expect(copyButton().getAttribute('aria-label')).toBe('Copied')
})

test('a rejected rich clipboard write falls back to plain text without reporting failure', async () => {
	vi.stubGlobal('ClipboardItem', class {})
	const write = vi.fn().mockRejectedValue(new Error('Rich content denied'))
	Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write, writeText } })
	writeText.mockResolvedValue(undefined)
	await act(async () => copyButton().click())
	expect(write).toHaveBeenCalledTimes(1)
	expect(writeText).toHaveBeenCalledExactlyOnceWith('Markdown')
	expect(copyButton().getAttribute('aria-label')).toBe('Copied')
	expect(container.querySelector('[role="alert"]')).toBeNull()
})
