import type { Editor } from '@tiptap/react'
import { useCallback, useSyncExternalStore } from 'react'

export function useArticleEditable(editor: Editor) {
	const subscribe = useCallback(
		(notify: () => void) => {
			// setEditable emits update, not the transaction event watched by useEditorState.
			editor.on('update', notify)
			return () => {
				editor.off('update', notify)
			}
		},
		[editor]
	)
	return useSyncExternalStore(
		subscribe,
		() => editor.isEditable,
		() => editor.isEditable
	)
}
