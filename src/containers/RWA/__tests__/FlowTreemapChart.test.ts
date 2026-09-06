import { describe, expect, test } from 'vitest'
import type { RWAFlowTreemapNode } from '../flowTreemap'
import { buildRWAFlowTreemapChartData } from '../FlowTreemapChart'

function node(name: string, flowPercent: number, size: number): RWAFlowTreemapNode {
	return { name, value: [size, flowPercent], netFlowUsd: flowPercent }
}

describe('RWA flow treemap chart data', () => {
	test('prevents a tiny percentage outlier from washing out economically significant tiles', () => {
		const { colorCap } = buildRWAFlowTreemapChartData([
			node('Large', 10, 1000),
			node('Medium', 20, 900),
			node('Tiny outlier', 10_000, 1)
		])

		expect(colorCap).toBe(20)
	})

	test('keeps a large extreme move as the scale cap', () => {
		const { colorCap } = buildRWAFlowTreemapChartData([node('Large extreme', -100, 1000), node('Small move', 10, 100)])

		expect(colorCap).toBe(100)
	})
})
