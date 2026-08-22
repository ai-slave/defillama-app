// @vitest-environment happy-dom

import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
	LLAMA_AI_PROMPT_DRAFT_KEY,
	movePromptDraft,
	promptDraftKey,
	usePromptDraft
} from '~/containers/LlamaAI/hooks/usePromptDraft'
import { setStorageItem } from '~/contexts/localStorageStore'

const SCOPE = 'session:alpha'
const OTHER_SCOPE = 'session:beta'

function readDraft(scope: string): string | null {
	const raw = localStorage.getItem(promptDraftKey(scope))
	if (raw == null) return null
	try {
		return (JSON.parse(raw) as { value: string }).value
	} catch {
		return raw
	}
}

function writeDraft(scope: string, value: string, updatedAt = Date.now()) {
	localStorage.setItem(promptDraftKey(scope), JSON.stringify({ value, updatedAt }))
}

function DraftProbe({
	scope = SCOPE,
	onDraft
}: {
	scope?: string
	onDraft: (draft: string, setDraft: (nextDraft: string) => void) => void
}) {
	const [draft, setDraft] = usePromptDraft(scope)

	useEffect(() => {
		onDraft(draft, setDraft)
	}, [draft, setDraft, onDraft])

	return <span>{draft}</span>
}

function DraftTextarea({ scope = SCOPE }: { scope?: string }) {
	const [draft, setDraft] = usePromptDraft(scope)

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
		writeDraft(SCOPE, 'Compare ETH and SOL revenue')

		await act(async () => {
			root.render(<DraftProbe onDraft={() => undefined} />)
		})

		expect(container.textContent).toBe('Compare ETH and SOL revenue')
	})

	it('keeps each chat draft in its own slot', async () => {
		writeDraft(SCOPE, 'draft for alpha')
		writeDraft(OTHER_SCOPE, 'draft for beta')

		await act(async () => {
			root.render(<DraftProbe scope={SCOPE} onDraft={() => undefined} />)
		})
		expect(container.textContent).toBe('draft for alpha')

		await act(async () => {
			root.render(<DraftProbe scope={OTHER_SCOPE} onDraft={() => undefined} />)
		})
		expect(container.textContent).toBe('draft for beta')
	})

	it('shows an empty composer in a chat that has no draft, leaving the other chat untouched', async () => {
		writeDraft(SCOPE, 'unsent message in alpha')

		await act(async () => {
			root.render(<DraftProbe scope={OTHER_SCOPE} onDraft={() => undefined} />)
		})

		expect(container.textContent).toBe('')
		expect(readDraft(SCOPE)).toBe('unsent message in alpha')
	})

	it('does not leak a draft written in one scope into another', async () => {
		let updateDraft: (nextDraft: string) => void = () => undefined

		await act(async () => {
			root.render(
				<DraftProbe
					scope={SCOPE}
					onDraft={(_draft, setDraft) => {
						updateDraft = setDraft
					}}
				/>
			)
		})
		act(() => updateDraft('typed in alpha'))
		await act(async () => vi.advanceTimersByTime(300))

		expect(readDraft(SCOPE)).toBe('typed in alpha')
		expect(readDraft(OTHER_SCOPE)).toBeNull()
	})

	it('adopts a legacy unscoped draft once, then clears the legacy key', async () => {
		localStorage.setItem(LLAMA_AI_PROMPT_DRAFT_KEY, 'written before scoping existed')

		await act(async () => {
			root.render(<DraftProbe onDraft={() => undefined} />)
		})

		expect(container.textContent).toBe('written before scoping existed')
		expect(localStorage.getItem(LLAMA_AI_PROMPT_DRAFT_KEY)).toBeNull()
	})

	it('does not let a legacy draft overwrite an existing scoped draft', async () => {
		writeDraft(SCOPE, 'current draft')
		localStorage.setItem(LLAMA_AI_PROMPT_DRAFT_KEY, 'stale legacy draft')

		await act(async () => {
			root.render(<DraftProbe onDraft={() => undefined} />)
		})

		expect(container.textContent).toBe('current draft')
	})

	it('prunes drafts older than the retention window', async () => {
		const ancient = Date.now() - 8 * 24 * 60 * 60 * 1000
		writeDraft('session:ancient', 'forgotten', ancient)
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
		act(() => updateDraft('fresh'))
		await act(async () => vi.advanceTimersByTime(300))

		expect(readDraft('session:ancient')).toBeNull()
		expect(readDraft(SCOPE)).toBe('fresh')
	})

	it('caps how many drafts are retained', async () => {
		for (let index = 0; index < 40; index++) {
			writeDraft(`session:old-${index}`, `draft ${index}`, Date.now() - (40 - index) * 1000)
		}
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
		act(() => updateDraft('newest'))
		await act(async () => vi.advanceTimersByTime(300))

		const remaining = Object.keys(localStorage).filter((key) => key.startsWith(`${LLAMA_AI_PROMPT_DRAFT_KEY}:`))
		expect(remaining.length).toBeLessThanOrEqual(20)
		expect(readDraft(SCOPE)).toBe('newest')
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

		act(() => updateDraft('Show me stablecoin'))
		await act(async () => vi.advanceTimersByTime(299))
		expect(readDraft(SCOPE)).toBeNull()

		act(() => updateDraft('Show me stablecoin inflows'))
		await act(async () => vi.advanceTimersByTime(299))
		expect(readDraft(SCOPE)).toBeNull()

		await act(async () => vi.advanceTimersByTime(1))
		expect(readDraft(SCOPE)).toBe('Show me stablecoin inflows')
		expect(container.textContent).toBe('Show me stablecoin inflows')
	})

	it('removes a cleared draft immediately and cancels pending persistence', async () => {
		writeDraft(SCOPE, 'Existing draft')
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

		expect(readDraft(SCOPE)).toBeNull()
		await act(async () => vi.advanceTimersByTime(300))
		expect(readDraft(SCOPE)).toBeNull()
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

		act(() => updateDraft('Persist before leaving'))
		expect(readDraft(SCOPE)).toBeNull()

		await act(async () => root.render(null))
		expect(readDraft(SCOPE)).toBe('Persist before leaving')
	})

	it('preserves the caret when editing in the middle of the draft', async () => {
		writeDraft(SCOPE, 'hello world')

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

	it('updates when another consumer changes the same scope', async () => {
		await act(async () => {
			root.render(<DraftProbe onDraft={() => undefined} />)
		})

		await act(async () => {
			setStorageItem(
				promptDraftKey(SCOPE),
				JSON.stringify({ value: 'Draft from another composer', updatedAt: Date.now() })
			)
			await vi.runAllTimersAsync()
		})

		expect(container.textContent).toBe('Draft from another composer')
	})

	it('moves an in-memory draft when a temporary session receives its real id', async () => {
		let updateDraft: (nextDraft: string) => void = () => undefined
		await act(async () => {
			root.render(
				<DraftProbe
					scope="session:temporary"
					onDraft={(_draft, setDraft) => {
						updateDraft = setDraft
					}}
				/>
			)
		})
		act(() => updateDraft('follow up typed during the first response'))

		act(() => movePromptDraft('session:temporary', 'session:real'))
		await act(async () => root.render(<DraftProbe scope="session:real" onDraft={() => undefined} />))

		expect(container.textContent).toBe('follow up typed during the first response')
		expect(readDraft('session:temporary')).toBeNull()
		expect(readDraft('session:real')).toBe('follow up typed during the first response')
	})
})
