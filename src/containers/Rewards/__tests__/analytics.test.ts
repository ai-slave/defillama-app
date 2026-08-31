// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UMAMI_READY_EVENT } from '~/utils/analytics/umami'
import { observeRewardsLinks } from '../useRewardsAnalytics'

class TestObserver implements IntersectionObserver {
	readonly root = null
	readonly rootMargin = '0px'
	readonly scrollMargin = '0px'
	readonly thresholds = [0.5]
	readonly targets = new Set<Element>()
	constructor(private callback: IntersectionObserverCallback) {
		observers.push(this)
	}
	observe(target: Element) {
		this.targets.add(target)
	}
	unobserve(target: Element) {
		this.targets.delete(target)
	}
	disconnect() {
		this.targets.clear()
	}
	takeRecords(): IntersectionObserverEntry[] {
		return []
	}
	intersect(target: Element, intersectionRatio: number) {
		if (!this.targets.has(target)) throw new Error('Target is not observed')
		const rect = target.getBoundingClientRect()
		this.callback(
			[
				{
					target,
					intersectionRatio,
					isIntersecting: intersectionRatio > 0,
					boundingClientRect: rect,
					intersectionRect: rect,
					rootBounds: null,
					time: performance.now()
				}
			],
			this
		)
	}
}

let observers: TestObserver[] = []
const track = vi.fn()

function createState(): Parameters<typeof observeRewardsLinks>[2] {
	return { seen: new Set<string>(), pending: [] }
}

describe('Rewards link analytics', () => {
	let container: HTMLDivElement
	let button: HTMLAnchorElement
	let cleanup = () => {}
	beforeEach(() => {
		vi.useFakeTimers()
		vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
		vi.stubGlobal('IntersectionObserver', TestObserver)
		window.sessionStorage.clear()
		window.umami = { track, identify: vi.fn() }
		track.mockClear()
		observers = []
		container = document.createElement('div')
		button = document.createElement('a')
		button.dataset.rewardProgramId = 'contest'
		button.dataset.rewardProjectPath = '/protocol/example'
		container.appendChild(button)
		document.body.appendChild(container)
	})
	afterEach(() => {
		cleanup()
		container.remove()
		delete window.umami
		vi.restoreAllMocks()
		vi.unstubAllGlobals()
		vi.useRealTimers()
	})
	function intersect(ratio: number) {
		const observer = observers.at(-1)
		if (!observer) throw new Error('Missing observer')
		observer.intersect(button, ratio)
	}
	function click(type = 'click', mouseButton = 0) {
		button.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: mouseButton }))
	}
	const data = { program_id: 'contest', project_path: '/protocol/example' }

	it('requires continuous half-visible exposure in the foreground and cleans up pending dwell', () => {
		cleanup = observeRewardsLinks(container, 'test', createState())
		intersect(0.4)
		vi.advanceTimersByTime(1500)
		expect(track).not.toHaveBeenCalled()
		intersect(0.5)
		vi.advanceTimersByTime(900)
		vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
		document.dispatchEvent(new Event('visibilitychange'))
		vi.advanceTimersByTime(1500)
		expect(track).not.toHaveBeenCalled()
		vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
		document.dispatchEvent(new Event('visibilitychange'))
		vi.advanceTimersByTime(999)
		expect(track).not.toHaveBeenCalled()
		vi.advanceTimersByTime(1)
		expect(track).toHaveBeenCalledExactlyOnceWith('rewards-test-program-impression', data)
		cleanup()
		window.sessionStorage.clear()
		cleanup = observeRewardsLinks(container, 'test', createState())
		intersect(1)
		cleanup()
		vi.advanceTimersByTime(1500)
		expect(track).toHaveBeenCalledTimes(1)
	})

	it('records every click but one impression across remounts, including immediate and middle clicks', () => {
		cleanup = observeRewardsLinks(container, 'test', createState())
		click()
		click()
		click('auxclick', 1)
		click('auxclick', 2)
		expect(track.mock.calls).toEqual([
			['rewards-test-program-impression', data],
			['rewards-test-outbound-click', data],
			['rewards-test-outbound-click', data],
			['rewards-test-outbound-click', data]
		])
		cleanup()
		cleanup = observeRewardsLinks(container, 'test', createState())
		intersect(1)
		vi.advanceTimersByTime(1000)
		click()
		expect(track.mock.calls.filter(([event]) => event === 'rewards-test-program-impression')).toHaveLength(1)
		expect(track.mock.calls.filter(([event]) => event === 'rewards-test-outbound-click')).toHaveLength(4)
	})

	it('retains impressions across row changes when the tracker loads after ten seconds', () => {
		delete window.umami
		const state = createState()
		cleanup = observeRewardsLinks(container, 'test', state)
		intersect(1)
		vi.advanceTimersByTime(15_000)
		expect(track).not.toHaveBeenCalled()
		expect(window.sessionStorage.getItem('rewards-test:impression:contest')).toBeNull()
		cleanup()
		cleanup = observeRewardsLinks(container, 'test', state)
		window.umami = { track, identify: vi.fn() }
		window.dispatchEvent(new Event(UMAMI_READY_EVENT))
		window.dispatchEvent(new Event(UMAMI_READY_EVENT))
		intersect(1)
		vi.advanceTimersByTime(1000)
		expect(track).toHaveBeenCalledExactlyOnceWith('rewards-test-program-impression', data)
		expect(window.sessionStorage.getItem('rewards-test:impression:contest')).toBe('1')
	})

	it('flushes every early click once, even after the table replaces its observed rows', () => {
		delete window.umami
		const state = createState()
		cleanup = observeRewardsLinks(container, 'test', state)
		click()
		click()
		click('auxclick', 1)
		cleanup()
		cleanup = observeRewardsLinks(container, 'test', state)
		vi.advanceTimersByTime(15_000)
		expect(track).not.toHaveBeenCalled()
		window.umami = { track, identify: vi.fn() }
		window.dispatchEvent(new Event(UMAMI_READY_EVENT))
		window.dispatchEvent(new Event(UMAMI_READY_EVENT))
		expect(track.mock.calls).toEqual([
			['rewards-test-program-impression', data],
			['rewards-test-outbound-click', data],
			['rewards-test-outbound-click', data],
			['rewards-test-outbound-click', data]
		])
		click()
		expect(track).toHaveBeenCalledTimes(5)
	})

	it('does not flush after unmount or permanently suppress an unsent impression', () => {
		delete window.umami
		cleanup = observeRewardsLinks(container, 'test', createState())
		click()
		cleanup()
		window.umami = { track, identify: vi.fn() }
		window.dispatchEvent(new Event(UMAMI_READY_EVENT))
		expect(track).not.toHaveBeenCalled()
		expect(window.sessionStorage.getItem('rewards-test:impression:contest')).toBeNull()
		cleanup = observeRewardsLinks(container, 'test', createState())
		intersect(1)
		vi.advanceTimersByTime(1000)
		expect(track).toHaveBeenCalledExactlyOnceWith('rewards-test-program-impression', data)
	})

	it('ignores source links and cancelled navigation', () => {
		cleanup = observeRewardsLinks(container, 'test', createState())
		const source = document.createElement('a')
		container.appendChild(source)
		source.dispatchEvent(new MouseEvent('click', { bubbles: true }))
		button.addEventListener('click', (event) => event.preventDefault())
		click()
		expect(track).not.toHaveBeenCalled()
	})

	it('does not send events when off or when production tracking runs on localhost', () => {
		cleanup = observeRewardsLinks(container, 'off', createState())
		click()
		cleanup()
		cleanup = observeRewardsLinks(container, 'production', createState())
		click()
		expect(observers).toHaveLength(0)
		expect(track).not.toHaveBeenCalled()
	})
})
