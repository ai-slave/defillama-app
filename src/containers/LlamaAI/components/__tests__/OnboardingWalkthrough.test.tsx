// @vitest-environment happy-dom
import * as Ariakit from '@ariakit/react'
import { act, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { AgenticAnswerMode } from '../../types'
import { MobileToolsPopover } from '../input/MobileToolsPopover'
import { ModeToggle } from '../input/ModeToggle'
import { OnboardingWalkthrough } from '../OnboardingWalkthrough'
const complete = vi.fn()
const submit = vi.fn()
let root: Root
let container: HTMLDivElement
function Harness() {
	const [mode, setMode] = useState<AgenticAnswerMode>('quick')
	const [open, setOpen] = useState(true)
	const alerts = Ariakit.useDialogStore()
	const alertsOpen = Ariakit.useStoreState(alerts, 'open')
	const input = useRef<HTMLTextAreaElement>(null)
	return (
		<>
			<textarea ref={input} aria-label="Prompt" />
			<Ariakit.PopoverProvider>
				<Ariakit.PopoverDisclosure data-walkthrough="explore-button">Explore</Ariakit.PopoverDisclosure>
				<Ariakit.Popover modal aria-label="Capabilities" portal>
					<Ariakit.PopoverDismiss>Close capabilities</Ariakit.PopoverDismiss>
				</Ariakit.Popover>
			</Ariakit.PopoverProvider>
			<Ariakit.DialogDisclosure store={alerts} data-walkthrough="alerts-item">
				Alerts
			</Ariakit.DialogDisclosure>
			<Ariakit.Dialog store={alerts} aria-label="Alerts">
				<Ariakit.DialogDismiss>Close alerts</Ariakit.DialogDismiss>
			</Ariakit.Dialog>
			<button type="button" data-walkthrough="image-upload">
				Upload
			</button>
			<ModeToggle mode={mode} setMode={setMode} />
			{open ? (
				<OnboardingWalkthrough
					isAlertsModalOpen={alertsOpen}
					mode={mode}
					setMode={setMode}
					promptInputRef={input}
					onComplete={() => {
						complete()
						setOpen(false)
					}}
					handleSubmit={submit}
				/>
			) : null}
		</>
	)
}
beforeEach(async () => {
	vi.clearAllMocks()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	await act(async () => root.render(<Harness />))
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})
function button(text: string) {
	return [...document.querySelectorAll<HTMLButtonElement>('button')].find((e) => e.textContent?.trim() === text)!
}
const frame = () => new Promise((resolve) => setTimeout(resolve, 20))
// Waits for the control instead of a fixed delay: spotlight steps measure their target on a later frame.
async function click(text: string) {
	await waitForUi(() => expect(button(text)).toBeDefined(), { interval: 10 })
	await act(async () => {
		button(text).click()
		await frame()
	})
}
async function escape(el: HTMLElement) {
	await act(async () => {
		el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
		await frame()
	})
}
test('Escape skips the named intro without submitting and returns focus to the prompt', async () => {
	await waitForUi(() => expect(document.activeElement).toBe(button('Show me around')))
	const intro = button('Show me around').closest('[role="dialog"]')!
	expect(document.getElementById(intro.getAttribute('aria-labelledby')!)?.textContent).toBe('Welcome to LlamaAI')
	await escape(button('Show me around'))
	expect(complete).toHaveBeenCalledOnce()
	expect(submit).not.toHaveBeenCalled()
	expect(document.activeElement).toBe(container.querySelector('textarea'))
})
test('Show me around moves to the next step at once instead of after the intro animation', async () => {
	await waitForUi(() => expect(button('Show me around')).toBeDefined())
	await act(async () => button('Show me around').click())
	expect(document.querySelector('[aria-label="Skip walkthrough"]')).not.toBeNull()
})
test('an expanded highlighted popover stays usable and Escape resumes the same tour step', async () => {
	await click('Show me around')
	await waitForUi(() => expect(button('Try this control')).toBeDefined())
	await click('Try this control')
	expect(document.activeElement).toBe(button('Explore'))
	await click('Explore')
	await waitForUi(() => expect(button('Try this control')).toBeUndefined())
	expect(complete).not.toHaveBeenCalled()
	await escape(button('Close capabilities'))
	await waitForUi(() => expect(button('Try this control')).toBeDefined())
	expect(complete).not.toHaveBeenCalled()
	expect(document.querySelector('[role="status"]')?.textContent).toBe('Step 2 of 6')
})
test('advancing the full tour preserves mode until Research is selected and never submits automatically', async () => {
	await click('Show me around')
	await click('Next')
	await click('Next')
	await click('Next')
	await click('Try this control')
	const quick = container.querySelector<HTMLInputElement>('input[value="quick"]')!
	expect(document.activeElement).toBe(quick)
	expect(quick.checked).toBe(true)
	await act(async () => container.querySelector<HTMLInputElement>('input[value="research"]')!.click())
	await waitForUi(() => expect(button('Start chatting')).toBeDefined())
	expect(submit).not.toHaveBeenCalled()
	await click('Start chatting')
	expect(complete).toHaveBeenCalledOnce()
	expect(submit).not.toHaveBeenCalled()
	expect(document.activeElement).toBe(container.querySelector('textarea'))
})

test('opening Alerts pauses the tour and closing it resumes the same step', async () => {
	await click('Show me around')
	await click('Next')
	await click('Try this control')
	await click('Alerts')
	expect(button('Try this control')).toBeUndefined()
	expect(complete).not.toHaveBeenCalled()
	await escape(button('Close alerts'))
	await waitForUi(() => expect(button('Try this control')).toBeDefined())
	expect(document.querySelector('[role="status"]')?.textContent).toBe('Step 3 of 6')
	expect(complete).not.toHaveBeenCalled()
})

test('on a tablet the tour leaves out Alerts, whose sidebar row is mounted but hidden', async () => {
	await act(async () => root.unmount())
	vi.stubGlobal('matchMedia', (query: string) => ({
		matches: query === '(max-width: 1023px)',
		media: query,
		addEventListener: () => {},
		removeEventListener: () => {}
	}))
	try {
		root = createRoot(container)
		await act(async () => root.render(<Harness />))
		await click('Show me around')
		await click('Next')
		await click('Try this control')
		expect(document.activeElement).toBe(button('Upload'))
		expect(document.querySelector('[role="status"]')?.textContent).toBe('Step 3 of 5')
	} finally {
		vi.unstubAllGlobals()
	}
})

test.each(['Skip', 'Escape'])(
	'on a phone drawer step, %s ends the tour and closes the tools drawer it opened',
	async (how) => {
		await act(async () => root.unmount())
		vi.stubGlobal('matchMedia', (query: string) => ({
			matches: query === '(max-width: 639px)',
			media: query,
			addEventListener: () => {},
			removeEventListener: () => {}
		}))
		function PhoneHarness() {
			const [touring, setTouring] = useState(true)
			const input = useRef<HTMLTextAreaElement>(null)
			const [mode, setMode] = useState<AgenticAnswerMode>('quick')
			return (
				<>
					<textarea ref={input} aria-label="Prompt" />
					<MobileToolsPopover
						mode={mode}
						setMode={setMode}
						onPromptSelect={() => {}}
						onImageUploadClick={() => {}}
						isPending={false}
						walkthroughActive={touring}
					/>
					{touring ? (
						<OnboardingWalkthrough
							isAlertsModalOpen={false}
							mode={mode}
							setMode={setMode}
							promptInputRef={input}
							onComplete={() => {
								complete()
								setTouring(false)
							}}
							handleSubmit={submit}
						/>
					) : null}
				</>
			)
		}
		try {
			root = createRoot(container)
			await act(async () => root.render(<PhoneHarness />))
			const tools = () => document.querySelector('[data-walkthrough="mobile-tools-button"]')!
			await click('Show me around')
			await waitForUi(() => expect(tools().getAttribute('aria-expanded')).toBe('true'))
			await waitForUi(() => expect(button('Try this control')).toBeDefined())
			if (how === 'Skip') await click('Skip')
			else await escape(button('Try this control'))
			expect(complete).toHaveBeenCalledOnce()
			expect(tools().getAttribute('aria-expanded')).toBe('false')
		} finally {
			vi.unstubAllGlobals()
		}
	}
)
