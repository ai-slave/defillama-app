// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { getInstanceByDom } from 'echarts/core'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installChartCanvas } from '~/utils/testing/chartCanvas'
import { waitForUi } from '~/utils/testing/waitForUi'
import { PerformanceMatrix } from '../PerformanceMatrix'
import type { UtrLeaderboardRow } from '../types'

// happy-dom never loads an image; this one loads on the next task, or fails for a `broken` source. The chart
// library loads its symbol images through it too, with `onload` handlers.
class LoadingImage {
	decoding = ''
	crossOrigin = ''
	width = 48
	height = 48
	onload: (() => void) | null = null
	onerror: (() => void) | null = null
	#listeners: Array<[string, () => void]> = []
	addEventListener(type: string, listener: () => void) {
		this.#listeners.push([type, listener])
	}
	set src(value: string) {
		const type = value.includes('broken') ? 'error' : 'load'
		setTimeout(() => {
			for (const [listenerType, listener] of this.#listeners) if (listenerType === type) listener()
			;(type === 'load' ? this.onload : this.onerror)?.call(this)
		}, 0)
	}
}

const row = (asset: string, iconDataUrl: string | null): UtrLeaderboardRow => ({
	asset,
	name: asset,
	symbol: asset.toUpperCase(),
	sector: null,
	listingStatus: 'listed',
	disclosureLevel: 'full',
	claimed: true,
	fdvUsd: null,
	iconDataUrl,
	scores: {
		overall: 60,
		overallMomChangePct: null,
		disclosure: 8,
		performance: 7,
		rank: 1,
		disclosureRubrics: [],
		performanceRubrics: []
	}
})

let root: Root
let container: HTMLDivElement
let imageLoads: number
beforeEach(() => {
	installChartCanvas()
	imageLoads = 0
	vi.stubGlobal(
		'Image',
		class extends LoadingImage {
			constructor() {
				super()
				imageLoads++
			}
		}
	)
	vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,cropped')
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

const symbols = () =>
	(
		getInstanceByDom(container.querySelector<HTMLElement>('[_echarts_instance_]')!)!.getOption() as any
	).series[0].data.map((point: { symbol: string }) => point.symbol)

test('draws cropped logos once every logo settles, and a narrower row set draws at once from them', async () => {
	const client = new QueryClient()
	const rows = [
		row('alpha', 'data:image/png;base64,alpha'),
		row('beta', 'data:image/png;base64,broken'),
		row('gamma', null)
	]
	const render = (shown: Array<UtrLeaderboardRow>) =>
		act(async () =>
			root.render(
				<QueryClientProvider client={client}>
					<PerformanceMatrix rows={shown} />
				</QueryClientProvider>
			)
		)

	await render(rows)
	expect(container.textContent).toContain('Loading chart')
	await waitForUi(() => expect(container.textContent).not.toContain('Loading chart'))
	// A logo that fails to load falls back to a dot instead of holding the chart.
	expect(symbols()).toEqual(['image://data:image/png;base64,cropped', 'circle', 'circle'])

	const loadsBefore = imageLoads
	await render([rows[0]])
	expect(container.textContent).not.toContain('Loading chart')
	expect(symbols()).toEqual(['image://data:image/png;base64,cropped'])
	expect(imageLoads).toBe(loadsBefore)
})
