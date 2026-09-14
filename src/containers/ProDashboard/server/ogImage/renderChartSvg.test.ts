import { describe, expect, test } from 'vitest'
import { buildSingleMetricChartDataset } from '~/containers/ProDashboard/components/singleMetricChart'
import { renderChartSvg, renderChartSvgDataUri } from './renderChartSvg'

const DAY_IN_SECONDS = 86_400

function seriesData(points: number): Array<[number, number]> {
	return Array.from({ length: points }, (_, index): [number, number] => [
		1_700_000_000 + index * DAY_IN_SECONDS,
		1000 + index * 37
	])
}

describe('dashboard og chart svg', () => {
	test('renders a filled line as svg paths', () => {
		const svg = renderChartSvg(buildSingleMetricChartDataset(seriesData(30), 'Aave TVL', false), 346, 190)

		expect(svg).toContain('<svg')
		expect(svg).toContain('<path')
		const [lineCommands] = [...svg!.matchAll(/<path d="([^"]+)"/g)].map((match) => match[1])
		expect(lineCommands.length).toBeGreaterThan(50)
	})

	test('returns null for an empty dataset', () => {
		expect(renderChartSvg(buildSingleMetricChartDataset([], 'Aave TVL', false), 346, 190)).toBe(null)
		expect(renderChartSvgDataUri(buildSingleMetricChartDataset([], 'Aave TVL', false), 346, 190)).toBe(null)
	})

	test('encodes the svg as a base64 data uri', () => {
		const dataUri = renderChartSvgDataUri(buildSingleMetricChartDataset(seriesData(12), 'Fees', false), 346, 190)

		expect(dataUri).toMatch(/^data:image\/svg\+xml;base64,/)
		const decoded = Buffer.from(dataUri!.replace('data:image/svg+xml;base64,', ''), 'base64').toString('utf8')
		expect(decoded).toContain('<path')
	})
})
