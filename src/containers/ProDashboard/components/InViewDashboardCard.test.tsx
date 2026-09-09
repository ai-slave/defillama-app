// @vitest-environment happy-dom

import { act, useEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { withEChartsRenderVisibility } from '~/components/ECharts/renderVisibility'
import { InViewDashboardCard } from './InViewDashboardCard'

describe('InViewDashboardCard', () => {
	let container: HTMLDivElement
	let root: Root
	let observers: Array<MockIntersectionObserver>

	class MockIntersectionObserver implements IntersectionObserver {
		readonly root = null
		readonly thresholds = [0]
		readonly rootMargin: string
		readonly scrollMargin = '0px'
		private readonly callback: IntersectionObserverCallback
		private target: Element = document.body

		constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
			this.callback = callback
			this.rootMargin = options?.rootMargin ?? '0px'
			observers.push(this)
		}

		observe(target: Element) {
			this.target = target
		}

		unobserve() {}

		disconnect() {}

		takeRecords(): Array<IntersectionObserverEntry> {
			return []
		}

		emit(isIntersecting: boolean, height: number) {
			const boundingClientRect = new DOMRect(0, 0, 0, height)
			const entry: IntersectionObserverEntry = {
				time: 0,
				target: this.target,
				rootBounds: null,
				boundingClientRect,
				intersectionRect: isIntersecting ? boundingClientRect : new DOMRect(),
				isIntersecting,
				intersectionRatio: isIntersecting ? 1 : 0
			}
			this.callback([entry], this)
		}
	}

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		observers = []
		vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		vi.unstubAllGlobals()
	})

	test('defers the card until it is near, then keeps card state mounted while suspending its renderer', async () => {
		const queryStarted = vi.fn()
		const mounted = vi.fn()
		const unmounted = vi.fn()
		const Renderer = withEChartsRenderVisibility(function Renderer() {
			useEffect(() => {
				mounted()
				return unmounted
			}, [])
			return <div>Chart renderer</div>
		})
		function StatefulCard() {
			queryStarted()
			const [selection, setSelection] = useState('USDC')
			return (
				<>
					<button type="button" onClick={() => setSelection('USDT')}>
						{selection}
					</button>
					<Renderer />
				</>
			)
		}

		await act(async () =>
			root.render(
				<InViewDashboardCard minHeight={360}>
					<StatefulCard />
				</InViewDashboardCard>
			)
		)
		expect(queryStarted).not.toHaveBeenCalled()
		expect(mounted).not.toHaveBeenCalled()
		expect(container.querySelector('[role="status"]')?.textContent).toContain('Loading dashboard card')
		expect(container.firstElementChild?.getAttribute('aria-busy')).toBe('true')
		const observer = observers[0]
		if (!observer) throw new Error('Expected the dashboard card observer')

		await act(async () => observer.emit(true, 420))
		expect(queryStarted).toHaveBeenCalled()
		expect(mounted).toHaveBeenCalledOnce()
		const button = container.querySelector<HTMLButtonElement>('button')
		if (!button) throw new Error('Expected the stateful card button')
		await act(async () => button.click())
		expect(container.textContent).toBe('USDTChart renderer')

		await act(async () => observer.emit(false, 420))
		expect(unmounted).toHaveBeenCalledOnce()
		expect(container.textContent).toBe('USDT')

		await act(async () => observer.emit(true, 420))
		expect(mounted).toHaveBeenCalledTimes(2)
		expect(container.textContent).toBe('USDTChart renderer')
	})

	test('bounds mounted renderers while scrolling a 24-card dashboard', async () => {
		let activeRenderers = 0
		let peakRenderers = 0
		const Renderer = withEChartsRenderVisibility(function Renderer({ index }: { index: number }) {
			useEffect(() => {
				activeRenderers += 1
				peakRenderers = Math.max(peakRenderers, activeRenderers)
				return () => {
					activeRenderers -= 1
				}
			}, [])
			return <div>Chart {index}</div>
		})

		await act(async () =>
			root.render(
				<>
					{Array.from({ length: 24 }, (_, index) => (
						<InViewDashboardCard key={index} minHeight={360}>
							<Renderer index={index} />
						</InViewDashboardCard>
					))}
				</>
			)
		)
		expect(activeRenderers).toBe(0)

		await act(async () => {
			for (const observer of observers.slice(0, 8)) {
				observer.emit(true, 360)
			}
		})
		expect(activeRenderers).toBe(8)

		await act(async () => {
			for (const observer of observers.slice(0, 8)) {
				observer.emit(false, 360)
			}
			for (const observer of observers.slice(8, 16)) {
				observer.emit(true, 360)
			}
		})
		expect(activeRenderers).toBe(8)
		expect(peakRenderers).toBe(8)
	})
})
