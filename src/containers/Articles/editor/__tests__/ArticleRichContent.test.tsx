// @vitest-environment happy-dom
import { EditorContent, useEditor, type Editor, type JSONContent } from '@tiptap/react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, test } from 'vitest'
import { waitForUi } from '~/utils/testing/waitForUi'
import { TableControlsOverlay } from '../ArticleEditorControls'
import { createArticleEditorExtensions } from '../extensions'

const extensions = createArticleEditorExtensions()
const image: JSONContent = {
	type: 'articleImage',
	attrs: {
		src: '/image.png',
		alt: 'Original description',
		headline: 'Original headline',
		credit: 'Original credit',
		caption: 'Original caption'
	}
}
let editor: Editor
let root: Root
let container: HTMLDivElement
function Harness({ content, editable }: { content: JSONContent; editable: boolean }) {
	const instance = useEditor({ extensions, content, editable })
	if (instance) editor = instance
	return (
		<>
			<EditorContent editor={instance} />
			{instance ? <TableControlsOverlay editor={instance} /> : null}
		</>
	)
}
async function mount(content: JSONContent, editable = true) {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	await act(async () => root.render(<Harness content={content} editable={editable} />))
}
function button(text: string) {
	return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
		(element) => element.textContent?.trim() === text || element.getAttribute('aria-label') === text
	)!
}
async function click(text: string) {
	await act(async () => button(text).click())
}
async function fill(placeholder: string, value: string) {
	const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[placeholder="${placeholder}"]`)!
	await act(async () => {
		const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
		Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value)
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
}
async function escape() {
	await act(async () =>
		document.activeElement!.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
		)
	)
}
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	window.localStorage.clear()
})

test('cancels image credit drafts from any control, returns focus, and saves the edited credit fields', async () => {
	await mount({ type: 'doc', content: [image, { type: 'paragraph' }] })
	await click('Credit')
	await waitForUi(() => expect(document.activeElement?.getAttribute('placeholder')).toBe('Image title'))
	expect(button('Credit').getAttribute('aria-expanded')).toBe('true')
	await fill('Image title', 'Changed headline')
	await act(async () => button('Save').focus())
	await escape()
	await waitForUi(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
	expect(editor.getJSON().content![0].attrs!.headline).toBe('Original headline')
	await waitForUi(() => expect(document.activeElement).toBe(button('Credit')))
	await click('Credit')
	expect(document.querySelector<HTMLInputElement>('[placeholder="Image title"]')!.value).toBe('Original headline')
	await fill('Image title', 'Saved headline')
	await fill('Photographer or illustrator', 'New credit')
	await click('Save')
	expect(editor.getJSON().content![0].attrs).toMatchObject({ headline: 'Saved headline', credit: 'New credit' })
})

test('saves a normalized image link and keeps Cancel available for an existing link', async () => {
	await mount({
		type: 'doc',
		content: [{ ...image, attrs: { ...image.attrs, href: 'https://original.example' } }, { type: 'paragraph' }]
	})
	await click('Link')
	await fill('https://…', 'changed.example')
	await click('Cancel')
	expect(editor.getJSON().content![0].attrs!.href).toBe('https://original.example')
	await click('Link')
	await fill('https://…', 'new.example')
	await click('Save')
	expect(editor.getJSON().content![0].attrs!.href).toBe('https://new.example')
	await click('Link')
	await click('Remove link')
	expect(editor.getJSON().content![0].attrs!.href).toBe('')
})

test('undo restores image captions and removing a caption does not resurrect its draft', async () => {
	await mount({ type: 'doc', content: [image, { type: 'paragraph' }] })
	await click('Caption')
	expect(editor.getJSON().content![0].attrs!.caption).toBe('')
	expect(document.querySelector('[aria-label="Image caption"]')).toBeNull()
	await act(async () => {
		editor.commands.undo()
	})
	expect(document.querySelector<HTMLTextAreaElement>('[aria-label="Image caption"]')!.value).toBe('Original caption')
	await click('Caption')
	await click('Caption')
	await waitForUi(() => expect(document.activeElement?.getAttribute('aria-label')).toBe('Image caption'))
	expect(document.querySelector<HTMLTextAreaElement>('[aria-label="Image caption"]')!.value).toBe('')
	await fill('Add a caption…', 'New caption')
	await act(async () => document.querySelector<HTMLTextAreaElement>('[aria-label="Image caption"]')!.blur())
	expect(editor.getJSON().content![0].attrs!.caption).toBe('New caption')
})

function table(text: string): JSONContent {
	return {
		type: 'table',
		content: [
			{
				type: 'tableRow',
				content: [{ type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }]
			}
		]
	}
}
test('table actions follow the selected table and undo restores its rows', async () => {
	await mount({ type: 'doc', content: [table('first'), { type: 'paragraph' }, table('second'), { type: 'paragraph' }] })
	let secondPos = 0
	editor.state.doc.descendants((node, pos) => {
		if (node.isText && node.text === 'second') secondPos = pos
	})
	await act(async () => {
		editor.commands.setTextSelection(secondPos)
	})
	await click('Add row below')
	const tables = editor.getJSON().content!.filter((node) => node.type === 'table')
	expect(tables[0].content).toHaveLength(1)
	expect(tables[1].content).toHaveLength(2)
	expect(button('Watermark').getAttribute('aria-pressed')).toBe('true')
	await click('Watermark')
	expect(button('Watermark').getAttribute('aria-pressed')).toBe('false')
	await act(async () => {
		editor.commands.undo()
	})
	expect(editor.getJSON().content!.filter((node) => node.type === 'table')[1].content).toHaveLength(1)
	await act(async () => {
		editor.commands.setTextSelection(editor.state.doc.content.size - 1)
	})
	expect(document.querySelector('[aria-label="Table controls"]')).toBeNull()
})

test('table actions show for a table that holds the caret when the editor opens, and never read-only', async () => {
	// A new editor places the caret at the start of the document, inside a leading table, before any transaction.
	await mount({ type: 'doc', content: [table('first'), { type: 'paragraph' }] })
	expect(document.querySelector('[aria-label="Table controls"]')).not.toBeNull()
	await act(async () => root.unmount())
	container.remove()
	await mount({ type: 'doc', content: [table('first'), { type: 'paragraph' }] }, false)
	expect(document.querySelector('[aria-label="Table controls"]')).toBeNull()
})

test('read-only rich content exposes its text without edit controls', async () => {
	await mount(
		{
			type: 'doc',
			content: [
				image,
				{
					type: 'articleEmbed',
					attrs: {
						config: {
							provider: 'youtube',
							url: 'https://www.youtube.com/embed/123',
							sourceUrl: 'https://www.youtube.com/watch?v=123'
						}
					}
				},
				{ type: 'articlePeoplePanel' },
				{ type: 'llamaaiChart', attrs: { caption: 'Chart notes' } },
				{
					type: 'qa',
					content: [
						{ type: 'qaQuestion', content: [{ type: 'text', text: 'Question?' }] },
						{ type: 'qaAnswer', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Answer.' }] }] }
					]
				},
				{ type: 'paragraph' }
			]
		},
		false
	)
	expect(container.querySelector('button,input,textarea')).toBeNull()
	expect(container.textContent).toContain('Original caption')
	expect(container.textContent).toContain('Chart notes')
	expect(container.textContent).toContain('Question?')
})

test('closes image editing controls when the editor becomes read-only', async () => {
	await mount({ type: 'doc', content: [image, { type: 'paragraph' }] })
	await click('Alt')
	await act(async () => {
		editor.setEditable(false)
	})
	expect(container.querySelector('button,textarea')).toBeNull()
	expect(document.querySelector('[role="dialog"]')).toBeNull()
	await act(async () => {
		editor.setEditable(true)
	})
	await click('Alt')
	expect(
		document.querySelector<HTMLTextAreaElement>('[placeholder="Describe the image for screen readers"]')!.value
	).toBe('Original description')
})
