import { vi } from 'vitest'

/**
 * happy-dom has no 2D canvas and no layout, so real ECharts can neither paint nor size itself. This stands
 * in for those browser APIs only: drawing calls do nothing, text measures six pixels per character, and
 * every element reports the given client size. ECharts itself stays real, so a test reads what the chart
 * holds through `getInstanceByDom(...).getOption()` and what it shows through the DOM, instead of a
 * library fake. Undo it with `vi.restoreAllMocks()`.
 */
export function installChartCanvas({ width = 800, height = 400 }: { width?: number; height?: number } = {}) {
	const context: Record<PropertyKey, unknown> = {}
	const gradient = { addColorStop() {} }
	const methods: Record<string, unknown> = {
		measureText: (text: string) => ({ width: text.length * 6 }),
		getImageData: () => ({ data: new Uint8ClampedArray(4) }),
		createLinearGradient: () => gradient,
		createRadialGradient: () => gradient,
		createPattern: () => gradient
	}
	const stub = new Proxy(context, {
		get: (target, key) =>
			key in target ? target[key] : typeof key === 'string' && key in methods ? methods[key] : noop,
		set: (target, key, value) => {
			target[key] = value
			return true
		}
	})
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => stub as never)
	vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width)
	vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(() => height)
}

function noop() {}
