import { describe, expect, it } from 'vitest'
import type { RWAFlowTreemapNode } from '../flowTreemap'
import { buildRWAFlowTreemapChartData } from '../FlowTreemapChart'

function node(name: string, flowPercent: number | null): RWAFlowTreemapNode {
	return { name, value: [100, flowPercent], netFlowUsd: flowPercent }
}

describe('RWA flow treemap chart data', () => {
	it('keeps the exact p90 color cap and neutral endpoints', () => {
		const positiveNodes = Array.from({ length: 10 }, (_, index) => node(String(index + 1), index + 1))
		const positiveData = buildRWAFlowTreemapChartData(positiveNodes)

		expect(positiveData[7].itemStyle.color).not.toBe('rgb(38,159,60)')
		expect(positiveData[8].itemStyle.color).toBe('rgb(38,159,60)')
		expect(positiveData[9].itemStyle.color).toBe('rgb(38,159,60)')

		const endpointData = buildRWAFlowTreemapChartData([node('Outflow', -5), node('Zero', 0), node('Missing', null)])
		expect(endpointData.map((item) => item.itemStyle.color)).toEqual(['rgb(148,46,56)', '#8b929a', '#8b929a'])
	})
})
