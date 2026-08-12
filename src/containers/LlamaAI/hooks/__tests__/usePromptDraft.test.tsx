// @vitest-environment happy-dom

import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
		vi.useFakeTimers()
		localStorage.clear()
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		await vi.runAllTimersAsync()
		vi.useRealTimers()
		container.remove()
	})

	it('restores a saved prompt draft when the composer mounts', async () => {
		localStorage.setItem(LLAMA_AI_PROMPT_DRAFT_KEY, 'Compare ETH and SOL revenue')

		await act(async () => {
			root.render(<DraftProbe onDraft={() => undefined} />)
		})

		expect(container.textContent).toBe('Compare ETH and SOL revenue')
	})

	it('debounces persistence until typing pauses', async () => {
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

		act(() => {
			updateDraft('Show me stablecoin')
		})

		await act(async () => vi.advanceTimersByTime(299))
		expect(localStorage.getItem(LLAMA_AI_PROMPT_DRAFT_KEY)).toBeNull()

		act(() => {
			updateDraft('Show me stablecoin inflows')
		})
		await act(async () => vi.advanceTimersByTime(299))
		expect(localStorage.getItem(LLAMA_AI_PROMPT_DRAFT_KEY)).toBeNull()

		await act(async () => vi.advanceTimersByTime(1))
		expect(localStorage.getItem(LLAMA_AI_PROMPT_DRAFT_KEY)).toBe('Show me stablecoin inflows')
		expect(container.textContent).toBe('Show me stablecoin inflows')
	})

	it('removes a cleared draft immediately and cancels pending persistence', async () => {
		localStorage.setItem(LLAMA_AI_PROMPT_DRAFT_KEY, 'Existing draft')
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

		act(() => {
			updateDraft('Replacement draft')
			updateDraft('')
		})

		expect(localStorage.getItem(LLAMA_AI_PROMPT_DRAFT_KEY)).toBeNull()
		await act(async () => vi.advanceTimersByTime(300))
		expect(localStorage.getItem(LLAMA_AI_PROMPT_DRAFT_KEY)).toBeNull()
		expect(container.textContent).toBe('')
	})

	it('flushes pending persistence when the composer unmounts', async () => {
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

		act(() => {
			updateDraft('Persist before leaving')
		})
		expect(localStorage.getItem(LLAMA_AI_PROMPT_DRAFT_KEY)).toBeNull()

		await act(async () => root.render(null))
		expect(localStorage.getItem(LLAMA_AI_PROMPT_DRAFT_KEY)).toBe('Persist before leaving')
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
			await vi.runAllTimersAsync()
		})

		expect(container.textContent).toBe('Draft from another composer')
	})
})
