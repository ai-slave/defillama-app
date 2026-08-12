// @vitest-environment happy-dom

import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LLAMA_AI_PROMPT_DRAFT_KEY, usePromptDraft } from '~/containers/LlamaAI/hooks/usePromptDraft'
import { setStorageItem } from '~/contexts/localStorageStore'

function DraftProbe({ onDraft }: { onDraft: (draft: string, setDraft: (nextDraft: string) => void) => void }) {
	const [draft, setDraft] = usePromptDraft()

	useEffect(() => {
		onDraft(draft, setDraft)
	}, [draft, setDraft, onDraft])

	return <span>{draft}</span>
}

function DraftTextarea() {
	const [draft, setDraft] = usePromptDraft()

	return <textarea value={draft} onChange={(event) => setDraft(event.target.value)} />
}

describe('usePromptDraft', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		localStorage.clear()
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	it('restores a saved prompt draft when the composer mounts', async () => {
		localStorage.setItem(LLAMA_AI_PROMPT_DRAFT_KEY, 'Compare ETH and SOL revenue')

		await act(async () => {
			root.render(<DraftProbe onDraft={() => undefined} />)
		})

		expect(container.textContent).toBe('Compare ETH and SOL revenue')
	})

	it('persists edits and removes the draft when the composer clears', async () => {
		let updateDraft: (nextDraft: string) => void = () => undefined

		await act(async () => {
			root.render(
				<DraftProbe
					onDraft={(_draft, setDraft) => {
						updateDraft = setDraft
					}}
				/>
			)
		})

		await act(async () => {
			updateDraft('Show me stablecoin inflows')
			await new Promise((resolve) => setTimeout(resolve, 0))
		})
		expect(localStorage.getItem(LLAMA_AI_PROMPT_DRAFT_KEY)).toBe('Show me stablecoin inflows')
		expect(container.textContent).toBe('Show me stablecoin inflows')

		await act(async () => {
			updateDraft('')
			await new Promise((resolve) => setTimeout(resolve, 0))
		})
		expect(localStorage.getItem(LLAMA_AI_PROMPT_DRAFT_KEY)).toBeNull()
		expect(container.textContent).toBe('')
	})

	it('preserves the caret when editing in the middle of the draft', async () => {
		localStorage.setItem(LLAMA_AI_PROMPT_DRAFT_KEY, 'hello world')

		await act(async () => {
			root.render(<DraftTextarea />)
		})

		const textarea = container.querySelector('textarea')!
		const setTextareaValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!

		act(() => {
			setTextareaValue.call(textarea, 'hello! world')
			textarea.setSelectionRange(6, 6)
			textarea.dispatchEvent(new Event('input', { bubbles: true }))
		})

		expect(textarea.value).toBe('hello! world')
		expect(textarea.selectionStart).toBe(6)
		expect(textarea.selectionEnd).toBe(6)
	})

	it('updates when another storage consumer changes the draft', async () => {
		await act(async () => {
			root.render(<DraftProbe onDraft={() => undefined} />)
		})

		await act(async () => {
			setStorageItem(LLAMA_AI_PROMPT_DRAFT_KEY, 'Draft from another composer')
			await new Promise((resolve) => setTimeout(resolve, 0))
		})

		expect(container.textContent).toBe('Draft from another composer')
	})
})
