// @vitest-environment happy-dom

import { act, useEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { withEChartsRenderVisibility } from '~/components/ECharts/renderVisibility'
import { DASHBOARD_CARD_ROOT_MARGIN, InViewDashboardCard } from './InViewDashboardCard'

describe('InViewDashboardCard', () => {
	let container: HTMLDivElement
	let root: Root
	let callbacks: IntersectionObserverCallback[]
	const observe = vi.fn()
	const disconnect = vi.fn()

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		observe.mockReset()
		disconnect.mockReset()
		callbacks = []
		class MockIntersectionObserver {
			constructor(nextCallback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
				callbacks.push(nextCallback)
				expect(options?.rootMargin).toBe(DASHBOARD_CARD_ROOT_MARGIN)
			}
			observe = observe
			disconnect = disconnect
		}
		vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		vi.unstubAllGlobals()
	})

	it('keeps card state mounted while disposing only its renderer outside the viewport margin', async () => {
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
			const [selection, setSelection] = useState('USDC')
			return (
				<>
					<button onClick={() => setSelection('USDT')}>{selection}</button>
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
		expect(mounted).not.toHaveBeenCalled()
		expect(container.textContent).toBe('USDC')
		expect(container.firstElementChild?.getAttribute('aria-busy')).toBe('true')

		await act(async () =>
			callbacks[0](
				[{ isIntersecting: true, boundingClientRect: { height: 420 } } as IntersectionObserverEntry],
				{} as IntersectionObserver
			)
		)
		expect(mounted).toHaveBeenCalledOnce()
		await act(async () => (container.querySelector('button') as HTMLButtonElement).click())
		expect(container.textContent).toBe('USDTChart renderer')

		await act(async () =>
			callbacks[0](
				[{ isIntersecting: false, boundingClientRect: { height: 420 } } as IntersectionObserverEntry],
				{} as IntersectionObserver
			)
		)
		expect(unmounted).toHaveBeenCalledOnce()
		expect(container.textContent).toBe('USDT')
		expect((container.firstElementChild as HTMLElement).style.minHeight).toBe('420px')

		await act(async () =>
			callbacks[0](
				[{ isIntersecting: true, boundingClientRect: { height: 420 } } as IntersectionObserverEntry],
				{} as IntersectionObserver
			)
		)
		expect(mounted).toHaveBeenCalledTimes(2)
		expect(container.textContent).toBe('USDTChart renderer')
	})

	it('bounds mounted renderers while scrolling a 24-card dashboard', async () => {
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
			for (const callback of callbacks.slice(0, 8)) {
				callback(
					[{ isIntersecting: true, boundingClientRect: { height: 360 } } as IntersectionObserverEntry],
					{} as IntersectionObserver
				)
			}
		})
		expect(activeRenderers).toBe(8)

		await act(async () => {
			for (const callback of callbacks.slice(0, 8)) {
				callback(
					[{ isIntersecting: false, boundingClientRect: { height: 360 } } as IntersectionObserverEntry],
					{} as IntersectionObserver
				)
			}
			for (const callback of callbacks.slice(8, 16)) {
				callback(
					[{ isIntersecting: true, boundingClientRect: { height: 360 } } as IntersectionObserverEntry],
					{} as IntersectionObserver
				)
			}
		})
		expect(activeRenderers).toBe(8)
		expect(peakRenderers).toBe(8)
	})
})
