// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
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
	takeRecords(): Array<IntersectionObserverEntry> {
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

let observers: Array<TestObserver> = []
const track = vi.fn()

function createState(): Parameters<typeof observeRewardsLinks>[1] {
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
		container.dataset.rewardsVariant = 'a'
		button = document.createElement('a')
		button.dataset.rewardProgramId = 'contest'
		button.dataset.rewardPlacement = 'table'
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
	const data = {
		program_id: 'contest',
		project_path: '/protocol/example',
		experiment: 'rewards-featured-cards-v1',
		variant: 'a',
		placement: 'table'
	}
	const linkEvents = () =>
		track.mock.calls.filter(([event]) => event === 'rewards-program-impression' || event === 'rewards-outbound-click')

	test('requires continuous half-visible exposure in the foreground and cleans up pending dwell', () => {
		cleanup = observeRewardsLinks(container, createState())
		intersect(0.4)
		vi.advanceTimersByTime(1500)
		expect(linkEvents()).toEqual([])
		intersect(0.5)
		vi.advanceTimersByTime(900)
		vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
		document.dispatchEvent(new Event('visibilitychange'))
		vi.advanceTimersByTime(1500)
		expect(linkEvents()).toEqual([])
		vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
		document.dispatchEvent(new Event('visibilitychange'))
		vi.advanceTimersByTime(999)
		expect(linkEvents()).toEqual([])
		vi.advanceTimersByTime(1)
		expect(linkEvents()).toEqual([['rewards-program-impression', data]])
		cleanup()
		window.sessionStorage.clear()
		cleanup = observeRewardsLinks(container, createState())
		intersect(1)
		cleanup()
		vi.advanceTimersByTime(1500)
		expect(linkEvents()).toHaveLength(1)
	})

	test('records every click but one impression across remounts, including immediate and middle clicks', () => {
		cleanup = observeRewardsLinks(container, createState())
		click()
		click()
		click('auxclick', 1)
		click('auxclick', 2)
		expect(linkEvents()).toEqual([
			['rewards-program-impression', data],
			['rewards-outbound-click', data],
			['rewards-outbound-click', data],
			['rewards-outbound-click', data]
		])
		cleanup()
		cleanup = observeRewardsLinks(container, createState())
		intersect(1)
		vi.advanceTimersByTime(1000)
		click()
		expect(track.mock.calls.filter(([event]) => event === 'rewards-program-impression')).toHaveLength(1)
		expect(track.mock.calls.filter(([event]) => event === 'rewards-outbound-click')).toHaveLength(4)
	})

	test('retains impressions across row changes when the tracker loads after ten seconds', () => {
		delete window.umami
		const state = createState()
		cleanup = observeRewardsLinks(container, state)
		intersect(1)
		vi.advanceTimersByTime(15_000)
		expect(linkEvents()).toEqual([])
		expect(window.sessionStorage.getItem('rewards:rewards-featured-cards-v1:a:impression:table:contest')).toBeNull()
		cleanup()
		cleanup = observeRewardsLinks(container, state)
		window.umami = { track, identify: vi.fn() }
		window.dispatchEvent(new Event(UMAMI_READY_EVENT))
		window.dispatchEvent(new Event(UMAMI_READY_EVENT))
		intersect(1)
		vi.advanceTimersByTime(1000)
		expect(linkEvents()).toEqual([['rewards-program-impression', data]])
		expect(window.sessionStorage.getItem('rewards:rewards-featured-cards-v1:a:impression:table:contest')).toBe('1')
	})

	test('flushes every early click once, even after the table replaces its observed rows', () => {
		delete window.umami
		const state = createState()
		cleanup = observeRewardsLinks(container, state)
		click()
		click()
		click('auxclick', 1)
		cleanup()
		cleanup = observeRewardsLinks(container, state)
		vi.advanceTimersByTime(15_000)
		expect(linkEvents()).toEqual([])
		window.umami = { track, identify: vi.fn() }
		window.dispatchEvent(new Event(UMAMI_READY_EVENT))
		window.dispatchEvent(new Event(UMAMI_READY_EVENT))
		expect(linkEvents()).toEqual([
			['rewards-program-impression', data],
			['rewards-outbound-click', data],
			['rewards-outbound-click', data],
			['rewards-outbound-click', data]
		])
		click()
		expect(linkEvents()).toHaveLength(5)
	})

	test('does not flush after unmount or permanently suppress an unsent impression', () => {
		delete window.umami
		cleanup = observeRewardsLinks(container, createState())
		click()
		cleanup()
		window.umami = { track, identify: vi.fn() }
		window.dispatchEvent(new Event(UMAMI_READY_EVENT))
		expect(linkEvents()).toEqual([])
		expect(window.sessionStorage.getItem('rewards:rewards-featured-cards-v1:a:impression:table:contest')).toBeNull()
		cleanup = observeRewardsLinks(container, createState())
		intersect(1)
		vi.advanceTimersByTime(1000)
		expect(linkEvents()).toEqual([['rewards-program-impression', data]])
	})

	test('ignores source links and canceled navigation', () => {
		cleanup = observeRewardsLinks(container, createState())
		const source = document.createElement('a')
		container.appendChild(source)
		source.dispatchEvent(new MouseEvent('click', { bubbles: true }))
		button.addEventListener('click', (event) => event.preventDefault())
		click()
		expect(linkEvents()).toEqual([])
	})

	test('separates card and table impressions but counts one conversion per variant session', () => {
		container.dataset.rewardsVariant = 'b'
		button.dataset.rewardPlacement = 'table'
		const card = button.cloneNode(true) as HTMLAnchorElement
		card.dataset.rewardPlacement = 'card'
		container.appendChild(card)
		cleanup = observeRewardsLinks(container, createState())
		card.dispatchEvent(new MouseEvent('click', { bubbles: true }))
		click()
		click()
		cleanup()
		cleanup = observeRewardsLinks(container, createState())
		click()
		const events = (name: string) => track.mock.calls.filter(([event]) => event === `rewards-${name}`)
		expect(events('experiment-exposure')).toHaveLength(1)
		expect(events('experiment-conversion')).toHaveLength(1)
		expect(events('program-impression').map(([, eventData]) => eventData.placement)).toEqual(['card', 'table'])
		expect(events('outbound-click').map(([, eventData]) => eventData.placement)).toEqual([
			'card',
			'table',
			'table',
			'table'
		])
		expect(events('experiment-conversion')[0]?.[1]).toEqual({
			experiment: 'rewards-featured-cards-v1',
			variant: 'b',
			placement: 'card'
		})
	})

	test('waits for foreground exposure and queues experiment events until Umami is ready', () => {
		container.dataset.rewardsVariant = 'a'
		delete window.umami
		vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
		const state = createState()
		cleanup = observeRewardsLinks(container, state)
		expect(state.pending).toHaveLength(0)
		vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
		document.dispatchEvent(new Event('visibilitychange'))
		click()
		cleanup()
		cleanup = observeRewardsLinks(container, state)
		window.umami = { track, identify: vi.fn() }
		window.dispatchEvent(new Event(UMAMI_READY_EVENT))
		window.dispatchEvent(new Event(UMAMI_READY_EVENT))
		expect(track.mock.calls.map(([name]) => name)).toEqual([
			'rewards-experiment-exposure',
			'rewards-program-impression',
			'rewards-experiment-conversion',
			'rewards-outbound-click'
		])
	})
})
