// @vitest-environment happy-dom
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { act, useRef, useState, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { ArticleEditorCanvas } from '../ArticleEditorCanvas'
import { useEditorFlags } from '../ArticleEditorControls'

// Floating positioning is checked in the browser; retain the actual canvas,
// link controls, and Tiptap document for keyboard/draft behavior here.
vi.mock('@tiptap/react/menus', () => ({
	BubbleMenu: ({ children }: { children: ReactNode }) => children,
	FloatingMenu: () => null
}))
let root: Root
let container: HTMLDivElement
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})
test.each(['Link URL', 'Open in new tab'])(
	'Escape from %s cancels link edits and returns focus to the document',
	async (label) => {
		container = document.createElement('div')
		document.body.append(container)
		root = createRoot(container)
		const apply = vi.fn()
		function Harness() {
			const editor = useEditor({
				extensions: [StarterKit],
				content: '<p><a href="https://example.com">Existing link</a></p>',
				immediatelyRender: false
			})
			const flags = useEditorFlags(editor)
			const [linkEdit, setLinkEdit] = useState<{ url: string; newTab: boolean } | null>({
				url: 'https://example.com',
				newTab: true
			})
			const linkInputRef = useRef<HTMLInputElement>(null)
			return (
				<ArticleEditorCanvas
					editor={editor}
					flags={flags}
					linkEdit={linkEdit}
					setLinkEdit={setLinkEdit}
					linkInputRef={linkInputRef}
					activeEntity={null}
					blockItems={[]}
					markButtons={[]}
					readMins={1}
					wordCount={2}
					applyLink={apply}
					handleLinkRail={() => {}}
					openLinkEditor={() => {}}
					changeActiveEntityLink={() => {}}
					insertCallout={() => false}
					insertCitation={() => {}}
					onOpenChartPicker={() => {}}
					onOpenEmbedPicker={() => {}}
					openActiveEntityLink={() => {}}
					unsetActiveEntityLink={() => {}}
				/>
			)
		}
		await act(async () => root.render(<Harness />))
		const input = container.querySelector<HTMLInputElement>('[aria-label="Link URL"]')!
		await act(async () => {
			Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'https://changed.example')
			input.dispatchEvent(new Event('input', { bubbles: true }))
		})
		const control = container.querySelector<HTMLElement>(`[aria-label="${label}"]`)!
		await act(async () => {
			control.focus()
			control.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
			await new Promise((resolve) => setTimeout(resolve, 40))
		})
		expect(container.querySelector('[aria-label="Link URL"]')).toBeNull()
		expect(apply).not.toHaveBeenCalled()
		const documentElement = container.querySelector<HTMLElement>('[contenteditable="true"]')!
		expect(documentElement.querySelector('a')!.getAttribute('href')).toBe('https://example.com')
		expect(document.activeElement).toBe(documentElement)
	}
)
