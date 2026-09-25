// @vitest-environment happy-dom
import { afterEach, expect, test, vi } from 'vitest'
import { scrollToFirstUtrClaimError } from '../scrollToClaimError'

afterEach(() => {
	vi.restoreAllMocks()
	document.body.innerHTML = ''
})

function scrolledElements(reduceMotion: boolean) {
	vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: reduceMotion } as MediaQueryList)
	const scrolled: Array<{ id: string; options: ScrollIntoViewOptions }> = []
	vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(function (this: HTMLElement, options) {
		scrolled.push({ id: this.id, options: options as ScrollIntoViewOptions })
	})
	return scrolled
}

test('scrolls the first claim error into the middle of the view', () => {
	const scrolled = scrolledElements(false)
	document.body.innerHTML =
		'<form><p id="name">Name</p><p id="token" data-utr-claim-error>Token required</p><p id="email" data-utr-claim-error>Email required</p></form>'

	scrollToFirstUtrClaimError(document.querySelector('form'))

	expect(scrolled).toEqual([{ id: 'token', options: { behavior: 'smooth', block: 'center' } }])
})

test('jumps without animation for readers who prefer reduced motion', () => {
	const scrolled = scrolledElements(true)
	document.body.innerHTML = '<form><p id="token" data-utr-claim-error>Token required</p></form>'

	scrollToFirstUtrClaimError(document.querySelector('form'))

	expect(scrolled).toEqual([{ id: 'token', options: { behavior: 'auto', block: 'center' } }])
})

test('leaves the page where it is when the form has no errors', () => {
	const scrolled = scrolledElements(false)
	document.body.innerHTML = '<form><p id="name">Name</p></form>'

	scrollToFirstUtrClaimError(document.querySelector('form'))

	expect(scrolled).toEqual([])
})
