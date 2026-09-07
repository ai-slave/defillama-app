import * as Ariakit from '@ariakit/react'
import type { Editor } from '@tiptap/core'
import { createContext, useContext, useLayoutEffect, type ReactNode } from 'react'

export type SuggestionAnchor = {
	editor: Editor
	clientRect?: (() => DOMRect | null) | null
	dismiss: () => void
}

const SuggestionEditorContext = createContext<Editor | null>(null)

export function SuggestionPopover({
	editor,
	clientRect,
	dismiss,
	children
}: SuggestionAnchor & { children: ReactNode }) {
	const store = Ariakit.usePopoverStore({
		open: true,
		placement: 'bottom-start',
		setOpen: (open) => {
			if (!open) dismiss()
		}
	})
	useLayoutEffect(() => store.setAnchorElement(editor.view.dom), [editor, store])
	// The caret can move without resizing the editor or the popup.
	useLayoutEffect(() => {
		if (clientRect) store.render()
	}, [clientRect, store])
	return (
		<SuggestionEditorContext.Provider value={editor}>
			<Ariakit.Popover
				store={store}
				role="presentation"
				getAnchorRect={() => clientRect?.() ?? null}
				portal
				fixed
				gutter={8}
				overflowPadding={8}
				fitViewport
				autoFocusOnShow={false}
				autoFocusOnHide={false}
				hideOnInteractOutside={(event) => !editor.view.dom.contains(event.target as Node)}
				className="z-[70] max-w-[calc(100vw-16px)] focus:outline-hidden"
			>
				{children}
			</Ariakit.Popover>
		</SuggestionEditorContext.Provider>
	)
}

export function useSuggestionAccessibility(listId: string, activeId: string | null) {
	const editor = useContext(SuggestionEditorContext)
	useLayoutEffect(() => {
		if (!editor) return
		const input = editor.view.dom
		input.setAttribute('aria-controls', listId)
		input.setAttribute('aria-haspopup', 'listbox')
		input.setAttribute('aria-autocomplete', 'list')
		return () => {
			input.removeAttribute('aria-controls')
			input.removeAttribute('aria-haspopup')
			input.removeAttribute('aria-autocomplete')
			input.removeAttribute('aria-activedescendant')
		}
	}, [editor, listId])
	useLayoutEffect(() => {
		if (activeId) {
			editor?.view.dom.setAttribute('aria-activedescendant', activeId)
			const option = document.getElementById(activeId)
			const list = document.getElementById(listId)
			if (option && list) {
				const row = option.getBoundingClientRect()
				const bounds = list.getBoundingClientRect()
				if (row.top < bounds.top) list.scrollTop += row.top - bounds.top
				else if (row.bottom > bounds.bottom) list.scrollTop += row.bottom - bounds.bottom
			}
		} else editor?.view.dom.removeAttribute('aria-activedescendant')
	}, [editor, activeId, listId])
}
