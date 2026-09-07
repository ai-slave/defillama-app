// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { AgenticAnswerMode } from '../../../types'
import { MobileToolsPopover } from '../MobileToolsPopover'
import { ModeToggle } from '../ModeToggle'
vi.mock('~/auth', () => ({ useAuthContext: () => ({ user: null }) }))
vi.mock('../CapabilityBrowser', () => ({ BrowserContent: () => <button type="button">Example prompt</button> }))
let root: Root
let container: HTMLDivElement
const changed = vi.fn()
const gated = vi.fn()
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
function Harness({ mobile, blocked }: { mobile: boolean; blocked: boolean }) {
	const [mode, setMode] = useState<AgenticAnswerMode>('quick')
	const props = {
		mode,
		setMode: (next: AgenticAnswerMode) => {
			changed(next)
			setMode(next)
		},
		onFactCheckedGated: gated,
		factCheckedUsage: blocked
			? { period: 'blocked' as const, allowed: false, currentUsage: 0, remaining: 0, limit: 0, remainingUsage: 0 }
			: null
	}
	return mobile ? (
		<MobileToolsPopover {...props} isPending={false} onPromptSelect={vi.fn()} onImageUploadClick={vi.fn()} />
	) : (
		<ModeToggle {...props} />
	)
}
async function press(el: HTMLElement, key: string) {
	await act(async () => {
		el.focus()
		el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
		el.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }))
		await new Promise((resolve) => setTimeout(resolve, 30))
	})
}
test('desktop arrows select a mode without firing a callback on mount', async () => {
	await act(async () => root.render(<Harness mobile={false} blocked={false} />))
	expect(changed).not.toHaveBeenCalled()
	const quick = document.querySelector<HTMLInputElement>('input[value="quick"]')!
	await press(quick, 'ArrowRight')
	expect(document.querySelector<HTMLInputElement>('input[value="fact_checked"]')!.checked).toBe(true)
	expect(changed).toHaveBeenCalledExactlyOnceWith('fact_checked')
	await press(document.activeElement as HTMLElement, 'ArrowRight')
	expect(document.querySelector<HTMLInputElement>('input[value="research"]')!.checked).toBe(true)
})
test.each([false, true])('a gated selection leaves the original mode checked (mobile: %s)', async (mobile) => {
	await act(async () => root.render(<Harness mobile={mobile} blocked />))
	if (mobile)
		await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Open mobile tools"]')!.click())
	expect(changed).not.toHaveBeenCalled()
	const option = (
		mobile
			? [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')].find((item) =>
					item.textContent?.includes('Fact-checked')
				)
			: document.querySelector<HTMLElement>('input[value="fact_checked"]')
	)!
	await act(async () => option.click())
	expect(gated).toHaveBeenCalledOnce()
	expect(changed).not.toHaveBeenCalled()
	expect(
		(mobile
			? [...document.querySelectorAll('[role="menuitemradio"]')].find((item) => item.textContent?.includes('Quick'))
			: document.querySelector('input[value="quick"]'))!.getAttribute('aria-checked')
	).toBe('true')
})
