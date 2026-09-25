// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ResponseControls } from './ResponseControls'

// Heavy children whose output these tests do not read.
vi.mock('~/containers/LlamaAI/components/FeedbackForm', () => ({ FeedbackForm: () => null }))
vi.mock('~/containers/LlamaAI/components/PDFExportButton', () => ({ PDFExportButton: () => null }))
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
	expect(writeText).toHaveBeenCalledExactlyOnceWith('Response')
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
	expect(writeText).toHaveBeenCalledExactlyOnceWith('Response')
	expect(copyButton().getAttribute('aria-label')).toBe('Copied')
	expect(container.querySelector('[role="alert"]')).toBeNull()
})

test('shows final cost, duration and server completion time without opening details', async () => {
	const timestamp = Date.parse('2026-09-11T10:00:00Z')
	await act(async () =>
		root.render(
			<ResponseControls
				messageId="message"
				content="Response"
				readOnly
				timestamp={timestamp}
				messageMetadata={{ executionTimeMs: 112_000, x402CostUsd: '0.00004' }}
			/>
		)
	)
	expect(container.textContent).toContain('External data $0.00004')
	expect(container.textContent).toContain('1m 52s')
	expect(container.querySelector('time')?.getAttribute('datetime')).toBe('2026-09-11T10:00:00.000Z')
	expect(container.textContent).toContain('1m 52s·')
	expect(container.querySelector('[aria-label="Response details"]')).toBeNull()
})

test('older answers omit missing timing, while a recorded zero remains visible', async () => {
	expect(container.querySelector('time')).toBeNull()
	expect(container.textContent).not.toContain('External data')
	await act(async () =>
		root.render(
			<ResponseControls messageId="message" readOnly messageMetadata={{ executionTimeMs: 0, x402CostUsd: '0' }} />
		)
	)
	expect(container.textContent).toContain('0s')
	expect(container.textContent).toContain('External data $0.00')
})
