import { compile } from 'tailwindcss'
import { onTestFinished } from 'vitest'

/** Applies the Tailwind utilities named in `classes` for the rest of the test, with Tailwind's default breakpoints (the
    app sets no others), so happy-dom hides and shows what a browser at the same `window.happyDOM.setViewport` width
    would: a two-pane sheet's `max-md:hidden` pane, a drawer's `sm:hidden` title row. */
export async function applyBreakpointClasses(classes: Array<string>) {
	const style = document.createElement('style')
	style.textContent = (
		await compile(
			'@theme { --breakpoint-sm: 40rem; --breakpoint-md: 48rem; --breakpoint-lg: 64rem; } @tailwind utilities;'
		)
	).build(classes)
	document.head.append(style)
	onTestFinished(() => style.remove())
}
