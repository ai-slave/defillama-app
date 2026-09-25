// @vitest-environment happy-dom

import * as echarts from 'echarts/core'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installChartCanvas } from '~/utils/test/chartCanvas'
import MultiSeriesChart from '.'
import type { IMultiSeriesChartProps, MultiSeriesChartSeriesConfig } from './types'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
	installChartCanvas()
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.restoreAllMocks()
})

const EMPTY_DATASET = { dimensions: ['timestamp'], source: [] }

async function renderOption(props: Partial<IMultiSeriesChartProps> & { charts: Array<MultiSeriesChartSeriesConfig> }) {
	await act(async () => root.render(<MultiSeriesChart dataset={EMPTY_DATASET} exportButtons="hidden" {...props} />))
	const element = container.querySelector<HTMLElement>('[_echarts_instance_]')!
	// ECharts normalizes every component to an array.
	return echarts.getInstanceByDom(element)!.getOption() as Record<string, any>
}

const TVL: MultiSeriesChartSeriesConfig = {
	type: 'line',
	name: 'TVL',
	encode: { x: 0, y: 1 },
	data: [
		[1000, 10],
		[3000, 12]
	]
}
const FEES: MultiSeriesChartSeriesConfig = {
	type: 'bar',
	name: 'Fees',
	encode: { x: 0, y: 1 },
	data: [
		[1000, 2],
		[2000, 3]
	]
}

test('draws hallmarks on an Events rail after the data series, on its own hidden axis', async () => {
	const option = await renderOption({
		charts: [TVL, FEES],
		hallmarks: [[2000, 'Upgrade']],
		hallmarksInMs: true
	})

	expect(option.series.map((series: { name: string; type: string }) => [series.name, series.type])).toEqual([
		['TVL', 'line'],
		['Fees', 'bar'],
		['Events', 'custom']
	])
	const events = option.series[2]
	expect(events.yAxisIndex).toBe(option.yAxis.length - 1)
	expect(option.yAxis.at(-1)).toMatchObject({ show: false, min: -1, max: 1 })
	expect(
		events.data.map((event: { eventDate: number; fullText: string }) => [event.eventDate, event.fullText])
	).toEqual([[2000, 'Upgrade']])
})

test('draws no Events rail without hallmarks', async () => {
	const option = await renderOption({ charts: [TVL, FEES] })
	expect(option.series.map((series: { name: string }) => series.name)).toEqual(['TVL', 'Fees'])
})

test('leaves explicit null points as gaps in a line unless the series asks to connect them', async () => {
	const withGap: MultiSeriesChartSeriesConfig = {
		type: 'line',
		name: 'TVL',
		encode: { x: 0, y: 1 },
		data: [
			[1000, 10],
			[2500, null],
			[3000, 12]
		]
	}
	const option = await renderOption({ charts: [withGap, { ...withGap, name: 'Staking', connectNulls: true }] })

	expect(option.series[0].data).toEqual([
		[1000, 10],
		[2500, null],
		[3000, 12]
	])
	expect(option.series.map((series: { connectNulls: boolean }) => series.connectNulls)).toEqual([false, true])
})

test('shows an inside and a slider zoom over the full range once a series has two points', async () => {
	const option = await renderOption({ charts: [TVL] })
	// getOption drops the slider's `type` because slider is the default zoom kind.
	expect(
		option.dataZoom.map((zoom: { type?: string; start: number; end: number }) => [zoom.type, zoom.start, zoom.end])
	).toEqual([
		['inside', 0, 100],
		[undefined, 0, 100]
	])
})

test('omits the zoom when it is hidden or every series has a single point', async () => {
	expect((await renderOption({ charts: [TVL], hideDataZoom: true })).dataZoom).toEqual([])
	const single = await renderOption({
		charts: [
			{ ...TVL, data: [[1000, 10]] },
			{ ...FEES, data: [[2000, 5]] }
		]
	})
	expect(single.dataZoom).toEqual([])
})
