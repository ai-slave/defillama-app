import { act } from 'react'

/** Moves focus as a reader's Tab does: the Tab key goes down on the focused element, focus moves, the key comes up.
    Use it wherever the test means a reader reaching a control; a plain `focus()` is focus that code moved, which
    leaves a Tooltip closed (src/ui/Tooltip.tsx). */
export async function tabTo(element: HTMLElement) {
	const from = (document.activeElement ?? document.body) as HTMLElement
	await act(async () => {
		from.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
		element.focus()
		element.dispatchEvent(new KeyboardEvent('keyup', { key: 'Tab', bubbles: true, cancelable: true }))
		await new Promise((resolve) => setTimeout(resolve, 30))
	})
}
