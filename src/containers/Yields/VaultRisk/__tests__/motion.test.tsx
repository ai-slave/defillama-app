// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useInViewOnce } from '../primitives/motion'

let root: Root
let container: HTMLDivElement
let reveal: () => void
let reducedMotion: boolean
beforeEach(() => {
	reducedMotion = false
	vi.spyOn(window, 'matchMedia').mockImplementation(
		(query) => ({ matches: query === '(prefers-reduced-motion: reduce)' && reducedMotion }) as MediaQueryList
	)
	// The test scrolls the element into view by calling `reveal`.
	vi.stubGlobal(
		'IntersectionObserver',
		class {
			constructor(callback: IntersectionObserverCallback) {
				reveal = () => callback([{ isIntersecting: true } as IntersectionObserverEntry], this as never)
			}
			observe() {}
			disconnect() {}
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
})

function Strip({ onVisible }: { onVisible: (el: HTMLDivElement) => void }) {
	const ref = useInViewOnce<HTMLDivElement>(onVisible)
	return <div ref={ref}>strip</div>
}

test('runs the latest callback when the element comes into view', async () => {
	const first = vi.fn()
	const latest = vi.fn()
	await act(async () => root.render(<Strip onVisible={first} />))
	await act(async () => root.render(<Strip onVisible={latest} />))
	await act(async () => reveal())
	expect(first).not.toHaveBeenCalled()
	expect(latest).toHaveBeenCalledExactlyOnceWith(container.firstElementChild)
})

test('never runs for a reader who prefers reduced motion', async () => {
	reducedMotion = true
	const onVisible = vi.fn()
	reveal = () => {}
	await act(async () => root.render(<Strip onVisible={onVisible} />))
	await act(async () => reveal())
	expect(onVisible).not.toHaveBeenCalled()
})
