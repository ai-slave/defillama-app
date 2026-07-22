// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
	const instance = {
		dispose: vi.fn(),
		getOption: vi.fn(() => ({})),
		isDisposed: vi.fn(() => false),
		resize: vi.fn(),
		setOption: vi.fn()
	}

	return {
		handleChartReady: vi.fn(),
		init: vi.fn(() => instance),
		instance,
		isSmall: false,
		use: vi.fn()
	}
})

vi.mock('echarts/core', () => ({
	init: mocks.init,
	use: mocks.use
}))

vi.mock('~/contexts/LocalStorage', () => ({
	useDarkModeManager: () => [false]
}))

vi.mock('~/hooks/useChartImageExport', () => ({
	useChartImageExport: () => ({
		chartInstance: null,
		handleChartReady: mocks.handleChartReady
	})
}))

vi.mock('~/hooks/useChartResize', () => ({
	useChartResize: () => undefined
}))

vi.mock('~/hooks/useMedia', () => ({
	useMedia: () => mocks.isSmall
}))

vi.mock('~/components/ECharts/shared/chartTheme', () => ({
	useChartTheme: () => ({
		ink: (opacity: number) => `ink-${opacity}`,
		inkInverted: (opacity: number) => `ink-inverted-${opacity}`
	})
}))

import SankeyChart from '.'

const nodes = [
	{ name: 'Source', depth: 0, displayValue: 'source value' },
	{ name: 'Middle', depth: 1, displayValue: 'middle value' },
	{ name: 'A very long terminal node', depth: 2, displayValue: 'terminal value', percentageLabel: '70%' }
]

const links = [
	{ source: 'Source', target: 'Middle', value: 100 },
	{ source: 'Middle', target: 'A very long terminal node', value: 70 }
]

describe('SankeyChart responsive labels', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
			bottom: 450,
			height: 450,
			left: 0,
			right: 320,
			top: 0,
			width: 320,
			x: 0,
			y: 0,
			toJSON: () => ({})
		} as DOMRect)
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		mocks.isSmall = false
		vi.clearAllMocks()
	})

	afterEach(async () => {
		if (container.childNodes.length > 0) await act(async () => root.unmount())
		container.remove()
		vi.restoreAllMocks()
	})

	it('keeps every full mobile label visible and distributes collisions across levels', async () => {
		mocks.isSmall = true

		await act(async () => root.render(<SankeyChart nodes={nodes} links={links} />))

		const option = mocks.instance.setOption.mock.calls.at(-1)?.[0]
		const series = option.series

		expect(series.label).toMatchObject({
			fontSize: 14,
			lineHeight: 16,
			width: 132,
			overflow: 'break'
		})
		expect(series.label.formatter({ dataIndex: 2, name: 'A very long terminal node', value: 70 })).toBe(
			'A very long terminal node: terminal value (70%)'
		)
		const firstLayout = series.labelLayout({
			dataIndex: 0,
			dataType: 'node',
			labelRect: { x: 100, y: 100, width: 142, height: 32 }
		})
		const secondLayout = series.labelLayout({
			dataIndex: 1,
			dataType: 'node',
			labelRect: { x: 100, y: 100, width: 142, height: 32 }
		})
		expect(firstLayout.hideOverlap).toBe(false)
		expect(secondLayout.hideOverlap).toBe(false)
		expect(secondLayout.y).not.toBe(firstLayout.y)
		expect(series.nodeGap).toBe(32)
		expect(series).not.toHaveProperty('left')
		expect(series).not.toHaveProperty('right')
		expect(series.data.every((node: { label?: { position?: string } }) => node.label?.position)).toBe(true)
		expect(series.data.at(-1)?.label?.position).toBe('right')
		expect(option.tooltip.triggerOn).toBe('click')
		expect(option.tooltip.extraCssText).toContain('white-space: normal')
		expect(container.firstElementChild?.classList.contains('overflow-x-auto')).toBe(false)
		expect(container.textContent).not.toContain('Scroll horizontally to view the full flow.')
		expect((container.firstElementChild?.firstElementChild as HTMLElement | null)?.style.minHeight).toBe('450px')
		expect(container.querySelector('ol')).toBeNull()
	})

	it('keeps the full desktop label treatment', async () => {
		await act(async () => root.render(<SankeyChart nodes={nodes} links={links} />))

		const option = mocks.instance.setOption.mock.calls.at(-1)?.[0]
		const series = option.series

		expect(series.label).not.toHaveProperty('width')
		expect(series.label.formatter({ name: 'Source', value: 100 })).toBe('Source: source value')
		expect(series).not.toHaveProperty('labelLayout')
		expect(series.nodeGap).toBe(24)
		expect(series.data.every((node: { label?: unknown }) => node.label === undefined)).toBe(true)
		expect(option.tooltip.triggerOn).toBe('mousemove')
		expect(option.tooltip.extraCssText).toBeUndefined()
		expect(container.querySelector('ol')).toBeNull()
	})
})
