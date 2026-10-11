import { describe, expect, test } from 'vitest'
import { getChartTheme } from '~/components/ECharts/shared/chartTheme'
import { buildSingleMetricChartDataset } from '~/containers/ProDashboard/components/singleMetricChart'
import { renderChartSvg, renderChartSvgDataUri } from '../renderChartSvg'

const DAY_IN_SECONDS = 86_400

function seriesData(points: number): Array<[number, number]> {
	return Array.from({ length: points }, (_, index): [number, number] => [
		1_700_000_000 + index * DAY_IN_SECONDS,
		1000 + index * 37
	])
}

const BRAND = getChartTheme(true).brand

describe('dashboard og chart svg', () => {
	test('draws the series as a brand-blue line at the requested size', () => {
		const svg = renderChartSvg(buildSingleMetricChartDataset(seriesData(30), 'Aave TVL', false), 346, 190)!

		expect(svg).toMatch(/<svg[^>]*width="346"[^>]*height="190"/)
		const line = svg.match(new RegExp(`<path d="([^"]+)"[^>]*stroke="${BRAND}"`))
		// One move plus a line command per remaining point.
		expect(line?.[1].match(/L/g)).toHaveLength(29)
	})

	test('returns null for an empty dataset', () => {
		expect(renderChartSvg(buildSingleMetricChartDataset([], 'Aave TVL', false), 346, 190)).toBe(null)
		expect(renderChartSvgDataUri(buildSingleMetricChartDataset([], 'Aave TVL', false), 346, 190)).toBe(null)
	})

	test('encodes the rendered svg as a base64 data uri', () => {
		const dataset = buildSingleMetricChartDataset(seriesData(12), 'Fees', false)
		const dataUri = renderChartSvgDataUri(dataset, 346, 190)!

		expect(dataUri.startsWith('data:image/svg+xml;base64,')).toBe(true)
		const decoded = Buffer.from(dataUri.slice('data:image/svg+xml;base64,'.length), 'base64').toString('utf8')
		expect(decoded).toMatch(new RegExp(`^<svg width="346" height="190"[\\s\\S]*stroke="${BRAND}"[\\s\\S]*</svg>$`))
	})
})
