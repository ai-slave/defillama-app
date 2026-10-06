// @vitest-environment happy-dom

import { act, StrictMode, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { useComposerPrefill } from '../../hooks/useComposerPrefill'
import { PromptInput } from '../PromptInput'

const session = installSubscriberSession('reader', { resolved: true })

let host: HTMLDivElement
let root: Root
let prefill: (text: string) => void

/** The composer wired to its prefill request the way the chat wires it, for links and "Just ask". */
function Composer() {
	const promptInputRef = useRef<HTMLTextAreaElement | null>(null)
	const composerPrefill = useComposerPrefill()
	prefill = composerPrefill.prefill
	return (
		<PromptInput
			draftScope="chat:s1"
			submitMode={{ kind: 'direct' }}
			handleSubmit={() => true}
			promptInputRef={promptInputRef}
			isPending={false}
			handleStopRequest={() => {}}
			placeholder="Ask LlamaAI"
			shortPlaceholder="Ask LlamaAI"
			restoreRequest={composerPrefill.request}
			onRestoreConsumed={composerPrefill.consume}
			mode="quick"
			setMode={() => {}}
			enterToSend
		/>
	)
}

let showComposer: (show: boolean) => void

/** A composer that mounts after its prefill is requested, as the chat does when a link's prompt arrives before it. */
function LateComposer() {
	const promptInputRef = useRef<HTMLTextAreaElement | null>(null)
	const composerPrefill = useComposerPrefill()
	const [show, setShow] = useState(false)
	prefill = composerPrefill.prefill
	showComposer = setShow
	if (!show) return null
	return (
		<PromptInput
			draftScope="chat:s2"
			submitMode={{ kind: 'direct' }}
			handleSubmit={() => true}
			promptInputRef={promptInputRef}
			isPending={false}
			handleStopRequest={() => {}}
			placeholder="Ask LlamaAI"
			shortPlaceholder="Ask LlamaAI"
			restoreRequest={composerPrefill.request}
			onRestoreConsumed={composerPrefill.consume}
			mode="quick"
			setMode={() => {}}
			enterToSend
		/>
	)
}

const composer = () => host.querySelector('textarea')!

async function type(value: string) {
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(composer(), value)
		composer().dispatchEvent(new Event('input', { bubbles: true }))
	})
}

beforeEach(async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
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

test('a prefill reaches an empty composer after an earlier one was used', async () => {
	await act(async () => prefill('Compare Aave and Uniswap'))
	expect(composer().value).toBe('Compare Aave and Uniswap')

	await type('')
	await act(async () => prefill('Top chains by TVL'))
	expect(composer().value).toBe('Top chains by TVL')
})

test('a prefill leaves a draft the reader already typed', async () => {
	await type('my own question')
	await act(async () => prefill('Top chains by TVL'))
	expect(composer().value).toBe('my own question')
})

test('a prefill waiting for the composer lands when it mounts, through Strict Mode replaying the mount', async () => {
	await act(async () => root.unmount())
	root = createRoot(host)
	await act(async () =>
		root.render(
			<StrictMode>
				<session.Wrapper>
					<LateComposer />
				</session.Wrapper>
			</StrictMode>
		)
	)
	await act(async () => prefill('Compare Aave and Uniswap'))
	await act(async () => showComposer(true))
	expect(composer().value).toBe('Compare Aave and Uniswap')
})
