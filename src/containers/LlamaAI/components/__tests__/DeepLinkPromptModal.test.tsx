// @vitest-environment happy-dom
import { act, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { waitForUi } from '~/utils/testing/waitForUi'
import { DeepLinkPromptModal } from '../DeepLinkPromptModal'

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

function Page() {
	const promptInputRef = useRef<HTMLTextAreaElement>(null)
	const [open, setOpen] = useState(true)
	return (
		<main>
			<textarea ref={promptInputRef} aria-label="Prompt" />
			<DeepLinkPromptModal
				isOpen={open}
				prompt="What is Aave's TVL?"
				onClose={() => setOpen(false)}
				onConfirm={() => setOpen(false)}
				promptInputRef={promptInputRef}
			/>
		</main>
	)
}

test.each(['Cancel', 'Ask LlamaAI'])('%s on a question from a link continues in the composer', async (name) => {
	await act(async () => root.render(<Page />))
	const choice = [...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === name)!
	await act(async () => choice.click())
	await act(async () => {
		await waitForUi(() => expect(document.activeElement?.getAttribute('aria-label')).toBe('Prompt'))
	})
})
