// @vitest-environment happy-dom

import type { ECharts, EChartsOption } from 'echarts'
import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
	EChartsRenderVisibilityProvider,
	usePersistentEChartsLifecycle,
	withEChartsRenderVisibility
} from './renderVisibility'

describe('ECharts render visibility', () => {
	afterEach(() => {
		vi.unstubAllGlobals()
		document.body.replaceChildren()
	})

	it('restores only legend and data zoom interaction state after remounting', async () => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
			callback(0)
			return 1
		})
		const setOption = vi.fn()
		let currentOption: EChartsOption = {
			legend: [{ selected: { TVL: false } }],
			dataZoom: [{ start: 20, end: 80 }],
			series: [{ data: [1, 2, 3] }]
		}
		const instance = {
			isDisposed: () => false,
			getOption: () => currentOption,
			setOption
		} as unknown as ECharts

		const Renderer = withEChartsRenderVisibility(function Renderer() {
			const lifecycle = usePersistentEChartsLifecycle()
			useEffect(() => {
				lifecycle.restore(instance)
				return () => lifecycle.capture(instance)
			}, [lifecycle])
			return <canvas />
		})
		const container = document.createElement('div')
		document.body.appendChild(container)
		const root = createRoot(container)

		await act(async () =>
			root.render(
				<EChartsRenderVisibilityProvider visible>
					<Renderer />
				</EChartsRenderVisibilityProvider>
			)
		)
		expect(setOption).not.toHaveBeenCalled()

		await act(async () =>
			root.render(
				<EChartsRenderVisibilityProvider visible={false}>
					<Renderer />
				</EChartsRenderVisibilityProvider>
			)
		)
		await act(async () =>
			root.render(
				<EChartsRenderVisibilityProvider visible>
					<Renderer />
				</EChartsRenderVisibilityProvider>
			)
		)

		expect(setOption).toHaveBeenCalledWith({
			legend: [{ selected: { TVL: false } }],
			dataZoom: [{ start: 20, end: 80 }]
		})
		expect(setOption.mock.calls[0][0]).not.toHaveProperty('series')

		currentOption = {
			legend: [{ selected: { TVL: true } }],
			series: [{ data: [4, 5, 6] }]
		}
		setOption.mockClear()
		await act(async () =>
			root.render(
				<EChartsRenderVisibilityProvider visible={false}>
					<Renderer />
				</EChartsRenderVisibilityProvider>
			)
		)
		await act(async () =>
			root.render(
				<EChartsRenderVisibilityProvider visible>
					<Renderer />
				</EChartsRenderVisibilityProvider>
			)
		)
		expect(setOption).toHaveBeenCalledWith({ legend: [{ selected: { TVL: true } }] })
		expect(setOption.mock.calls[0][0]).not.toHaveProperty('dataZoom')

		currentOption = { series: [{ data: [7, 8, 9] }] }
		setOption.mockClear()
		await act(async () =>
			root.render(
				<EChartsRenderVisibilityProvider visible={false}>
					<Renderer />
				</EChartsRenderVisibilityProvider>
			)
		)
		await act(async () =>
			root.render(
				<EChartsRenderVisibilityProvider visible>
					<Renderer />
				</EChartsRenderVisibilityProvider>
			)
		)
		expect(setOption).not.toHaveBeenCalled()
		await act(async () => root.unmount())
	})
})
