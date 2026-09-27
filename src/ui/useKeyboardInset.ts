import { useEffect } from 'react'

/* iOS Safari ignores `interactive-widget=resizes-content`: the keyboard shrinks only the visual
   viewport, so a sheet pinned to the layout viewport's bottom sits under the keyboard. Publish the
   covered height as --keyboard-inset and the visible height as --visual-viewport-height on <html>,
   so the dialog surface can sit on top of the keyboard and fit above it. */
export function useKeyboardInset() {
	useEffect(() => {
		const vv = window.visualViewport
		if (!vv) return
		const root = document.documentElement
		let frame = 0

		const update = () => {
			frame = 0
			// Pinch zoom also shrinks the visual viewport; only the keyboard does it at scale 1.
			const zoomed = Math.abs(vv.scale - 1) > 0.01
			const inset = zoomed ? 0 : Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
			root.style.setProperty('--keyboard-inset', `${inset}px`)
			root.style.setProperty('--visual-viewport-height', `${zoomed ? window.innerHeight : Math.round(vv.height)}px`)
		}
		const schedule = () => {
			if (!frame) frame = requestAnimationFrame(update)
		}

		update()
		vv.addEventListener('resize', schedule)
		vv.addEventListener('scroll', schedule)
		return () => {
			vv.removeEventListener('resize', schedule)
			vv.removeEventListener('scroll', schedule)
			cancelAnimationFrame(frame)
		}
	}, [])
}
