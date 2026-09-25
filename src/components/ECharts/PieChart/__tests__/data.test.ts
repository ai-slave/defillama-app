import { describe, expect, test } from 'vitest'
import { CHART_COLORS } from '~/constants/colors'
import {
	buildPieLayoutOption,
	buildRuntimePieChartCsvDataset,
	buildRuntimePieChartPresentation,
	preparePieChartData,
	prepareRuntimePieChartData
} from '../data'

const buildRuntimePieChartData = (args: Parameters<typeof buildRuntimePieChartPresentation>[0]) =>
	buildRuntimePieChartPresentation(args).chartData

describe('preparePieChartData', () => {
	test('converts a Record into sorted { name, value } array', () => {
		expect(
			preparePieChartData({
				data: { Ethereum: 100, Solana: 300, Arbitrum: 200 }
			})
		).toEqual([
			{ name: 'Solana', value: 300 },
			{ name: 'Arbitrum', value: 200 },
			{ name: 'Ethereum', value: 100 }
		])
	})

	test('converts an array of records using custom identifiers', () => {
		expect(
			preparePieChartData({
				data: [
					{ chain: 'Ethereum', tvl: 100 },
					{ chain: 'Solana', tvl: 50 }
				],
				sliceIdentifier: 'chain',
				sliceValue: 'tvl'
			})
		).toEqual([
			{ name: 'Ethereum', value: 100 },
			{ name: 'Solana', value: 50 }
		])
	})

	test('limits slices and merges remainder into Others', () => {
		expect(
			preparePieChartData({
				data: { A: 100, B: 50, C: 30, D: 20, E: 10 },
				limit: 3
			})
		).toEqual([
			{ name: 'A', value: 100 },
			{ name: 'B', value: 50 },
			{ name: 'C', value: 30 },
			{ name: 'Others', value: 30 } // 20 + 10
		])
	})

	test('consolidates existing Others entry in top slices with overflow', () => {
		expect(
			preparePieChartData({
				data: { A: 100, Others: 80, C: 30, D: 20 },
				limit: 2
			})
		).toEqual([
			{ name: 'A', value: 100 },
			{ name: 'Others', value: 130 } // existing 80 + C(30) + D(20)
		])
	})

	test('normalizes numeric-string values from record-shaped JSON', () => {
		const data = { A: '10', B: '5', C: '2' } as unknown as Record<string, number>

		expect(preparePieChartData({ data, limit: 1 })).toEqual([
			{ name: 'A', value: 10 },
			{ name: 'Others', value: 7 }
		])
	})

	test('omits Others when overflow sum is 0', () => {
		const result = preparePieChartData({ data: { A: 100, B: 50 }, limit: 2 })
		expect(result).toEqual([
			{ name: 'A', value: 100 },
			{ name: 'B', value: 50 }
		])
	})
})

describe('runtime pie selection', () => {
	test('renders an upstream Others-only source without exposing it as selectable', () => {
		const series = prepareRuntimePieChartData({ data: { Others: 2 }, limit: 15 })

		expect(series.peers).toEqual([])
		expect(buildRuntimePieChartData({ series, selectedSeries: new Set() })).toEqual([{ name: 'Others', value: 2 }])
		expect(buildRuntimePieChartData({ series, selectedSeries: new Set(), includeUpstreamOthers: false })).toEqual([])
	})

	test('selects every peer while rendering top N plus a dynamic selected-tail Others', () => {
		const data = Object.fromEntries(Array.from({ length: 479 }, (_, index) => [`Chain ${index}`, 479 - index]))
		const series = prepareRuntimePieChartData({ data, limit: 10 })

		expect(series.peers).toHaveLength(479)
		expect(buildRuntimePieChartData({ series })).toHaveLength(11)

		const selectedSeries = new Set(series.peers.slice(1).map((peer) => peer.name))
		const rendered = buildRuntimePieChartData({ series, selectedSeries })
		expect(rendered[0]).toEqual({ name: 'Chain 1', value: 478 })
		expect(rendered.at(-1)).toEqual({
			name: 'Others',
			value: series.peers.slice(11).reduce((total, peer) => total + peer.value, 0)
		})
		expect(buildRuntimePieChartCsvDataset(series)).toEqual({
			dimensions: ['Name', 'Value'],
			source: series.peers.map(({ name, value }) => [name, value])
		})
	})

	test('renders exact selections below the visual limit without Others', () => {
		const series = prepareRuntimePieChartData({ data: { A: 4, B: 3, C: 2, D: 1 }, limit: 3 })
		expect(buildRuntimePieChartData({ series, selectedSeries: new Set(['B']) })).toEqual([{ name: 'B', value: 3 }])
		expect(buildRuntimePieChartData({ series, selectedSeries: new Set() })).toEqual([])
	})

	test('adds Others at N+1 and decreases it when a selected tail peer is removed', () => {
		const series = prepareRuntimePieChartData({ data: { A: 6, B: 5, C: 4, D: 3, E: 2 }, limit: 3 })
		expect(buildRuntimePieChartPresentation({ series }).stackColors).toMatchObject({
			A: CHART_COLORS[0],
			B: CHART_COLORS[1],
			C: CHART_COLORS[2],
			Others: CHART_COLORS[3]
		})
		expect(buildRuntimePieChartPresentation({ series, selectedSeries: new Set(['D']) }).stackColors).toMatchObject({
			D: CHART_COLORS[4]
		})
		const selectedTailPresentation = buildRuntimePieChartPresentation({
			series,
			selectedSeries: new Set(['B', 'C', 'D', 'E'])
		})
		expect(selectedTailPresentation.stackColors.D).not.toBe(selectedTailPresentation.stackColors.Others)
		expect(buildRuntimePieChartData({ series, selectedSeries: new Set(['A', 'B', 'C']) })).toEqual([
			{ name: 'A', value: 6 },
			{ name: 'B', value: 5 },
			{ name: 'C', value: 4 }
		])
		expect(buildRuntimePieChartData({ series, selectedSeries: new Set(['A', 'B', 'C', 'D']) }).at(-1)).toEqual({
			name: 'Others',
			value: 3
		})
		expect(buildRuntimePieChartData({ series, selectedSeries: new Set(['A', 'B', 'C', 'E']) }).at(-1)).toEqual({
			name: 'Others',
			value: 2
		})
	})

	test('keeps Others distinct from selected peers after the palette wraps', () => {
		const series = prepareRuntimePieChartData({
			data: Object.fromEntries(
				Array.from({ length: CHART_COLORS.length + 6 }, (_, index) => [`Peer ${index}`, 1000 - index])
			),
			limit: 3
		})
		const selectedSeries = new Set([
			'Peer 0',
			'Peer 1',
			`Peer ${CHART_COLORS.length + 2}`,
			`Peer ${CHART_COLORS.length + 3}`
		])
		const presentation = buildRuntimePieChartPresentation({ series, selectedSeries })

		expect(presentation.chartData.at(-1)?.name).toBe('Others')
		expect(presentation.stackColors[`Peer ${CHART_COLORS.length + 2}`]).not.toBe(presentation.stackColors.Others)
	})

	test('keeps peer colors stable across related views with different rankings', () => {
		const firstView = prepareRuntimePieChartData({ data: { USDC: 10, ETH: 5 }, limit: 3 })
		const secondView = prepareRuntimePieChartData({ data: { ETH: 20, USDC: 1 }, limit: 3 })
		const colorIndexByPeer = new Map([
			['USDC', 0],
			['ETH', 1]
		])

		expect(buildRuntimePieChartPresentation({ series: firstView, colorIndexByPeer }).stackColors).toEqual(
			buildRuntimePieChartPresentation({ series: secondView, colorIndexByPeer }).stackColors
		)
	})

	test('includes upstream Others only while every known peer is selected', () => {
		const series = prepareRuntimePieChartData({ data: { A: 4, B: 3, Others: 2 }, limit: 2 })
		expect(buildRuntimePieChartData({ series })).toEqual([
			{ name: 'A', value: 4 },
			{ name: 'B', value: 3 },
			{ name: 'Others', value: 2 }
		])
		expect(buildRuntimePieChartData({ series, selectedSeries: new Set(['A']) })).toEqual([{ name: 'A', value: 4 }])
		expect(buildRuntimePieChartData({ series, selectedSeries: new Set(['A', 'stale']) })).toEqual([
			{ name: 'A', value: 4 }
		])
		expect(buildRuntimePieChartData({ series, selectedSeries: new Set(['stale']) })).toEqual([])
		expect(buildRuntimePieChartData({ series, selectedSeries: new Set(['A', 'B', 'stale']) })).toEqual([
			{ name: 'A', value: 4 },
			{ name: 'B', value: 3 },
			{ name: 'Others', value: 2 }
		])
	})

	test('combines selected overflow with duplicate upstream Others rows', () => {
		const series = prepareRuntimePieChartData({
			data: [
				{ name: 'A', value: 5 },
				{ name: 'B', value: 4 },
				{ name: 'C', value: 3 },
				{ name: 'Others', value: 2 },
				{ name: 'Others', value: 1 }
			],
			limit: 2
		})

		expect(buildRuntimePieChartData({ series })).toEqual([
			{ name: 'A', value: 5 },
			{ name: 'B', value: 4 },
			{ name: 'Others', value: 6 }
		])
		expect(buildRuntimePieChartData({ series, selectedSeries: new Set(['A', 'B']) })).toEqual([
			{ name: 'A', value: 5 },
			{ name: 'B', value: 4 }
		])
	})

	test('does not create Others for a zero-valued selected tail', () => {
		const series = prepareRuntimePieChartData({ data: { A: 5, B: 0 }, limit: 1 })
		expect(series.peers.map((peer) => peer.name)).toEqual(['A'])
		expect(buildRuntimePieChartData({ series })).toEqual([{ name: 'A', value: 5 }])
	})

	test('coalesces duplicate selectable names before ranking and selection', () => {
		const series = prepareRuntimePieChartData({
			data: [
				{ name: 'A', value: 4 },
				{ name: 'B', value: 3 },
				{ name: 'A', value: 2 }
			],
			limit: 1
		})
		expect(series.peers.map((peer) => peer.name)).toEqual(['A', 'B'])
		expect(buildRuntimePieChartData({ series })).toEqual([
			{ name: 'A', value: 6 },
			{ name: 'Others', value: 3 }
		])
	})

	test('supports custom row keys while preserving first-seen order for tied values', () => {
		const series = prepareRuntimePieChartData({
			data: [
				{ token: 'stETH', stakedEth: 3 },
				{ token: 'rETH', stakedEth: 5 },
				{ token: 'stETH', stakedEth: 2 },
				{ token: 'cbETH', stakedEth: 5 }
			],
			limit: 2,
			sliceIdentifier: 'token',
			sliceValue: 'stakedEth'
		})

		expect(series.peers.map((peer) => peer.name)).toEqual(['stETH', 'rETH', 'cbETH'])
		expect(buildRuntimePieChartData({ series })).toEqual([
			{ name: 'stETH', value: 5 },
			{ name: 'rETH', value: 5 },
			{ name: 'Others', value: 5 }
		])
	})
})

describe('buildPieLayoutOption', () => {
	const layout = (overrides: Partial<Parameters<typeof buildPieLayoutOption>[0]> = {}) =>
		buildPieLayoutOption({
			width: 600,
			height: 360,
			reservedRight: 0,
			centerY: '50%',
			showLegend: false,
			isSmall: false,
			canvasWatermarkEnabled: true,
			isDark: false,
			...overrides
		})
	const watermark = (option: ReturnType<typeof buildPieLayoutOption>) => {
		const [graphic] = option.graphic ?? []
		if (!graphic) throw new Error('Expected a watermark')
		return { left: graphic.left, top: graphic.top, width: graphic.style.width, height: graphic.style.height }
	}

	test('centers the pie and its watermark in the whole canvas without a legend', () => {
		const option = layout()
		expect(option.series.center).toEqual(['50%', '50%'])
		expect(watermark(option)).toEqual({ left: 242, top: 160, width: 117, height: 40 })
	})

	test('centers the pie and its watermark in the width a right-side legend leaves', () => {
		const option = layout({ showLegend: true, reservedRight: 214 })
		expect(option.series.center).toEqual([193, '50%'])
		expect(watermark(option)).toMatchObject({ left: 135, top: 160 })
	})

	test('keeps a small-screen pie centered in the whole canvas even with a legend', () => {
		expect(layout({ showLegend: true, reservedRight: 214, isSmall: true }).series.center).toEqual(['50%', '50%'])
	})

	test('shrinks the watermark to fit a small pie and follows the canvas height', () => {
		expect(watermark(layout({ width: 150, height: 100 }))).toEqual({ left: 45, top: 40, width: 60, height: 21 })
		expect(watermark(layout({ height: 500 })).top).toBe(230)
	})

	test('leaves the watermark out inside Pro dashboards', () => {
		expect(layout({ canvasWatermarkEnabled: false })).not.toHaveProperty('graphic')
	})
})
