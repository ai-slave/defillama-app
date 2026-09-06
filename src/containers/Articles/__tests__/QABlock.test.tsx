// @vitest-environment happy-dom

import { Editor } from '@tiptap/core'
import { EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { QABlockNodes } from '../editor/nodes/QABlock'

function qa(question: string, answer: string, questionNumber?: string) {
	return {
		type: 'qa',
		...(questionNumber ? { attrs: { questionNumber } } : {}),
		content: [
			{ type: 'qaQuestion', content: [{ type: 'text', text: question }] },
			{ type: 'qaAnswer', content: [{ type: 'paragraph', content: [{ type: 'text', text: answer }] }] }
		]
	}
}

function changeInputValue(input: HTMLInputElement, value: string) {
	const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
	setValue?.call(input, value)
	input.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('Q&A block question number editor', () => {
	let container: HTMLDivElement
	let root: Root
	let editor: Editor

	beforeEach(() => {
		;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		editor = new Editor({
			extensions: [StarterKit, ...QABlockNodes],
			content: { type: 'doc', content: [qa('First?', 'First answer.'), qa('Second?', 'Second answer.')] }
		})
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		editor.destroy()
		container.remove()
	})

	test('shows automatic numbers and saves an override on blur', async () => {
		await act(async () => root.render(<EditorContent editor={editor} />))

		const inputs = container.querySelectorAll<HTMLInputElement>('input[aria-label="Question number"]')
		expect(inputs).toHaveLength(2)
		expect(inputs[0].placeholder).toBe('01')
		expect(inputs[1].placeholder).toBe('02')
		expect(inputs[1].style.width).toBe('calc(2ch + 1em)')

		await act(async () => {
			inputs[1].focus()
			changeInputValue(inputs[1], '012')
		})
		expect(inputs[1].style.width).toBe('calc(3ch + 1em)')
		await act(async () => inputs[1].blur())

		expect(editor.getJSON().content?.[1].attrs?.questionNumber).toBe('012')
		expect(editor.getHTML()).toContain('data-qa-number="012"')
	})

	test('clears an override back to automatic numbering', async () => {
		editor.commands.setContent({
			type: 'doc',
			content: [qa('First?', 'First answer.'), qa('Second?', 'Second answer.', '09')]
		})
		await act(async () => root.render(<EditorContent editor={editor} />))

		const input = container.querySelectorAll<HTMLInputElement>('input[aria-label="Question number"]')[1]
		expect(input.value).toBe('09')

		await act(async () => {
			input.focus()
			changeInputValue(input, '')
		})
		await act(async () => input.blur())

		expect(editor.getJSON().content?.[1].attrs?.questionNumber).toBeNull()
		expect(input.placeholder).toBe('02')
	})
})
