import { describe, expect, test } from 'vitest'
import type { ChartBuilderCsvRequest } from '~/containers/ProDashboard/chartBuilderCsvContract'
import { buildChartBuilderCsvPayload } from './csvData'

describe('buildChartBuilderCsvPayload', () => {
	test('exports a treemap as one row per entity using the selected calculation', () => {
		const request: ChartBuilderCsvRequest = {
			config: {
				metric: 'perps',
				mode: 'protocol',
				chainFilterMode: 'include',
				categoryFilterMode: 'include',
				chainCategoryFilterMode: 'include',
				protocolCategoryFilterMode: 'include',
				chains: [],
				categories: [],
				groupBy: 'protocol',
				limit: 10,
				chartType: 'treemap',
				treemapValue: 'sum7d',
				displayAs: 'timeSeries'
			},
			grouping: 'day',
			timePeriod: 'all',
			customTimePeriod: null,
			filename: 'perps.csv'
		}
		const day = 86_400
		const payload = buildChartBuilderCsvPayload(request, [
			{ name: 'Ethereum', data: [[day, 2]], color: '#000' },
			{ name: 'Solana', data: [[day, 3]], color: '#000' }
		])

		expect(payload.rows).toEqual([
			['Name', 'Sum 7d'],
			['Ethereum', 2],
			['Solana', 3]
		])
	})
})
