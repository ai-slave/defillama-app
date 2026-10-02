// @vitest-environment happy-dom
import { act, useRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { CAPABILITIES } from '../../capabilities'
import { PromptInput } from '../PromptInput'

const session = installSubscriberSession('reader', { account: 'free', resolved: true })
const READY_MADE = CAPABILITIES[0].prompts[0]

let host: HTMLDivElement
let root: Root
const handleSubmit = vi.fn(() => true)

function Composer() {
	const promptInputRef = useRef<HTMLTextAreaElement | null>(null)
	return (
		<PromptInput
			draftScope="chat:new"
			submitMode={{ kind: 'direct' }}
			handleSubmit={handleSubmit}
			promptInputRef={promptInputRef}
			isPending={false}
			handleStopRequest={() => {}}
			placeholder="Ask LlamaAI"
			shortPlaceholder="Ask LlamaAI"
			mode="quick"
			setMode={() => {}}
			enterToSend
		/>
	)
}

const composer = () => host.querySelector('textarea')!
const button = (name: string) =>
	[...document.querySelectorAll<HTMLElement>('button,[role="menuitem"]')].find(
		(el) => el.getAttribute('aria-label') === name || el.textContent?.trim() === name
	)!

async function type(value: string) {
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(composer(), value)
		composer().dispatchEvent(new Event('input', { bubbles: true }))
	})
}
async function pickReadyMade() {
	await act(async () => button('Explore').click())
	await act(async () => button(READY_MADE).click())
	expect(composer().value).toBe(READY_MADE)
}
async function send() {
	await act(async () => {
		composer()
			.closest('form')!
			.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
	})
	return waitForUi(() => {
		expect(handleSubmit).toHaveBeenCalledOnce()
		const [prompt, , , , isSuggestedQuestion] = handleSubmit.mock.calls[0] as unknown as [string, ...Array<unknown>]
		return { prompt, isSuggestedQuestion }
	})
}

beforeEach(async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	handleSubmit.mockClear()
	host = document.createElement('div')
	document.body.append(host)
	root = createRoot(host)
	await act(async () =>
		root.render(
			<session.Wrapper>
				<Composer />
			</session.Wrapper>
		)
	)
})
afterEach(async () => {
	await act(async () => root.unmount())
	host.remove()
})

test('a ready-made prompt picked from Explore is sent as a suggested question', async () => {
	await pickReadyMade()
	expect(await send()).toEqual({ prompt: READY_MADE, isSuggestedQuestion: true })
})

test('a ready-made prompt the reader edits before sending is sent as their own question', async () => {
	await pickReadyMade()
	await type(`${READY_MADE} on Base`)
	// The composer leaves the flag off for a typed question.
	expect(await send()).toEqual({ prompt: `${READY_MADE} on Base`, isSuggestedQuestion: undefined })
})
