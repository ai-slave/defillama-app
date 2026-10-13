import { useEffect } from 'react'

/* iOS Safari ignores `interactive-widget=resizes-content`: the keyboard shrinks only the visual
   viewport, so a sheet pinned to the layout viewport's bottom sits under the keyboard. Publish the
   covered height as --keyboard-inset and the visible height as --visual-viewport-height on <html>,
   so a sheet can pad its bottom by the keyboard and fit its content above it. Without a keyboard both equal
   their CSS fallbacks (0px, 100dvh), so they are set only while it covers the page: a first write to
   an inherited property on <html> restyles every element, and a dialog opening fires these events. */
export function useKeyboardInset() {
	useEffect(() => {
		const vv = window.visualViewport
		if (!vv) return
		const root = document.documentElement
		let frame = 0

		const clear = () => {
			root.style.removeProperty('--keyboard-inset')
			root.style.removeProperty('--visual-viewport-height')
		}
		const update = () => {
			frame = 0
			// Pinch zoom also shrinks the visual viewport; only the keyboard does it at scale 1.
			const zoomed = Math.abs(vv.scale - 1) > 0.01
			const inset = zoomed ? 0 : Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
			if (inset === 0) return clear()
			root.style.setProperty('--keyboard-inset', `${inset}px`)
			root.style.setProperty('--visual-viewport-height', `${Math.round(vv.height)}px`)
		}
		const schedule = () => {
			if (!frame) frame = requestAnimationFrame(update)
		}
		// iOS Safari resizes the visual viewport only once the keyboard has finished closing, so a sheet would hang above
		// the space it left. Leaving a text field for anything but another one closes the keyboard: drop the inset now.
		const onFocusOut = (event: FocusEvent) => {
			if (opensKeyboard(event.target) && !opensKeyboard(event.relatedTarget)) clear()
		}

		// No first update: no keyboard covers a page that is still loading, and reading the viewport here would force a
		// layout inside the hydration task.
		vv.addEventListener('resize', schedule)
		vv.addEventListener('scroll', schedule)
		document.addEventListener('focusout', onFocusOut)
		return () => {
			vv.removeEventListener('resize', schedule)
			vv.removeEventListener('scroll', schedule)
			document.removeEventListener('focusout', onFocusOut)
			cancelAnimationFrame(frame)
		}
	}, [])
}

// Input types that never bring up the on-screen keyboard.
const NON_TEXT_INPUT_TYPES = new Set([
	'checkbox',
	'radio',
	'range',
	'color',
	'file',
	'image',
	'button',
	'submit',
	'reset'
])

function opensKeyboard(target: EventTarget | null): boolean {
	return (
		target instanceof HTMLTextAreaElement ||
		(target instanceof HTMLInputElement && !NON_TEXT_INPUT_TYPES.has(target.type)) ||
		(target instanceof HTMLElement && target.isContentEditable)
	)
}
