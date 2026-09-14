import type { ECharts } from 'echarts/core'
// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest'
import { chartHoverSyncGroupSize, joinChartHoverSync } from './chartHoverSync'

type Handler = (event?: unknown) => void

function fakeChart() {
	const handlers = new Map<string, Handler>()
	const instance = {
		on: vi.fn((event: string, handler: Handler) => handlers.set(event, handler)),
		off: vi.fn((event: string) => handlers.delete(event)),
		dispatchAction: vi.fn(),
		isDisposed: vi.fn(() => false)
	}
	return {
		instance: instance as unknown as ECharts,
		dispatchAction: instance.dispatchAction,
		off: instance.off,
		emit: (event: string, payload?: unknown) => handlers.get(event)?.(payload),
		element: document.createElement('div')
	}
}

test('forwards the axis pointer to the other charts of the group and hides their tooltips on leave', () => {
	const source = fakeChart()
	const target = fakeChart()
	const stranger = fakeChart()
	const leaveSource = joinChartHoverSync('dashboard-1', source.instance, source.element)
	const leaveTarget = joinChartHoverSync('dashboard-1', target.instance, target.element)
	const leaveStranger = joinChartHoverSync('dashboard-2', stranger.instance, stranger.element)

	source.emit('updateAxisPointer', { type: 'updateAxisPointer', axesInfo: [{ axisDim: 'x', value: 1 }] })
	expect(target.dispatchAction).toHaveBeenCalledExactlyOnceWith({
		type: 'updateAxisPointer',
		axesInfo: [{ axisDim: 'x', value: 1 }]
	})
	expect(source.dispatchAction).not.toHaveBeenCalled()
	expect(stranger.dispatchAction).not.toHaveBeenCalled()

	source.emit('globalout')
	expect(target.dispatchAction).toHaveBeenLastCalledWith({ type: 'hideTip' })

	leaveSource()
	leaveTarget()
	leaveStranger()
	expect(chartHoverSyncGroupSize('dashboard-1')).toBe(0)
	expect(source.off).toHaveBeenCalledWith('updateAxisPointer', expect.any(Function))
})

test('a forwarded pointer does not echo back to the source', () => {
	const source = fakeChart()
	const target = fakeChart()
	const leaveSource = joinChartHoverSync('dashboard-3', source.instance, source.element)
	const leaveTarget = joinChartHoverSync('dashboard-3', target.instance, target.element)
	;(target.instance.dispatchAction as ReturnType<typeof vi.fn>).mockImplementation((action: unknown) =>
		target.emit('updateAxisPointer', action)
	)

	source.emit('updateAxisPointer', { type: 'updateAxisPointer', axesInfo: [] })
	expect(source.dispatchAction).not.toHaveBeenCalled()
	expect(target.dispatchAction).toHaveBeenCalledOnce()

	leaveSource()
	leaveTarget()
})

test('charts scrolled out of the viewport do not receive the pointer', () => {
	const observers: Array<{ callback: IntersectionObserverCallback; observe: ReturnType<typeof vi.fn> }> = []
	vi.stubGlobal(
		'IntersectionObserver',
		class {
			observe = vi.fn()
			disconnect = vi.fn()
			constructor(callback: IntersectionObserverCallback) {
				observers.push({ callback, observe: this.observe })
			}
		}
	)
	const source = fakeChart()
	const offscreen = fakeChart()
	const leaveSource = joinChartHoverSync('dashboard-4', source.instance, source.element)
	const leaveOffscreen = joinChartHoverSync('dashboard-4', offscreen.instance, offscreen.element)
	const offscreenObserver = observers[1]!
	offscreenObserver.callback(
		[{ isIntersecting: false } as IntersectionObserverEntry],
		offscreenObserver as unknown as IntersectionObserver
	)

	source.emit('updateAxisPointer', { type: 'updateAxisPointer', axesInfo: [] })
	expect(offscreen.dispatchAction).not.toHaveBeenCalled()

	offscreenObserver.callback(
		[{ isIntersecting: true } as IntersectionObserverEntry],
		offscreenObserver as unknown as IntersectionObserver
	)
	source.emit('updateAxisPointer', { type: 'updateAxisPointer', axesInfo: [] })
	expect(offscreen.dispatchAction).toHaveBeenCalledOnce()

	leaveSource()
	leaveOffscreen()
	vi.unstubAllGlobals()
})
