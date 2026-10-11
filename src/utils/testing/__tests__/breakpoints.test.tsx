// @vitest-environment happy-dom
import { expect, test } from 'vitest'
import { applyBreakpointClasses } from '../breakpoints'

test.each([
	[375, ['block', 'none']],
	[1024, ['none', 'block']]
] as const)('at %ipx, max-md:hidden and md:hidden hide the side they name', async (width, displays) => {
	window.happyDOM.setViewport({ width, height: 800 })
	const [narrowOnly, wideOnly] = [document.createElement('div'), document.createElement('div')]
	narrowOnly.className = 'md:hidden'
	wideOnly.className = 'max-md:hidden'
	document.body.append(narrowOnly, wideOnly)
	await applyBreakpointClasses(['md:hidden', 'max-md:hidden'])
	expect([getComputedStyle(narrowOnly).display, getComputedStyle(wideOnly).display]).toEqual(displays)
	narrowOnly.remove()
	wideOnly.remove()
})
