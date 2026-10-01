// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import VerifiedLanding from '..'

let root: Root
let container: HTMLDivElement
let visibility: DocumentVisibilityState
let reducedMotion: boolean
beforeEach(() => {
	vi.useFakeTimers()
	visibility = 'visible'
	reducedMotion = false
	vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
	vi.spyOn(window, 'matchMedia').mockImplementation(
		(query) =>
			({
				matches: query === '(prefers-reduced-motion: reduce)' && reducedMotion,
				addEventListener() {},
				removeEventListener() {}
			}) as unknown as MediaQueryList
	)
	// Every observed section is on screen, so the slideshow and the demo start.
	vi.stubGlobal(
		'IntersectionObserver',
		class {
			constructor(private callback: IntersectionObserverCallback) {}
			observe(target: Element) {
				this.callback([{ isIntersecting: true, target } as IntersectionObserverEntry], this as never)
			}
			disconnect() {}
			unobserve() {}
		}
	)
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
	vi.useRealTimers()
})

const shownState = () =>
	container
		.querySelector('[aria-label="Public verification record state slideshow"] [aria-pressed="true"]')!
		.textContent!.match(/^(Current|Partial|Stale|Unverified)/)![1]

test('the proof slideshow holds while the tab is hidden and moves on once it is visible again', async () => {
	visibility = 'hidden'
	await act(async () => root.render(<VerifiedLanding />))
	await act(async () => vi.advanceTimersByTime(6000))
	expect(shownState()).toBe('Current')

	visibility = 'visible'
	await act(async () => document.dispatchEvent(new Event('visibilitychange')))
	await act(async () => vi.advanceTimersByTime(5000))
	expect(shownState()).toBe('Partial')
})

test('the proof slideshow does not advance for a reader who prefers reduced motion', async () => {
	reducedMotion = true
	await act(async () => root.render(<VerifiedLanding />))
	await act(async () => vi.advanceTimersByTime(12_000))
	expect(shownState()).toBe('Current')
})
