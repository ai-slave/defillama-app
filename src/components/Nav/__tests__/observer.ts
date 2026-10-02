export class TestObserver implements IntersectionObserver {
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

export const observers: Array<TestObserver> = []
