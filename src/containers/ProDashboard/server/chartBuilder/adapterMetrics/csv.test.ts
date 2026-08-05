import { PassThrough } from 'node:stream'
import { describe, expect, it } from 'vitest'
import type { ChartBuilderCsvRequest } from '~/containers/ProDashboard/chartBuilderCsvContract'
import type { ProtocolBreakdownBase, ProtocolLookup } from './breakdowns/protocolSeries'
import { writeAdapterMetricProtocolCsv } from './csv'

const day = 86_400

const lookup: ProtocolLookup = {
	protocolCategories: new Map(),
	protocolCategoriesBySlug: new Map(),
	protocolToParentId: new Map(),
	parentIdToName: new Map()
}

function request(overrides: Partial<ChartBuilderCsvRequest> = {}): ChartBuilderCsvRequest {
	return {
		config: {
			metric: 'perps',
			mode: 'chains',
			chainFilterMode: 'include',
			categoryFilterMode: 'include',
			chainCategoryFilterMode: 'include',
			protocolCategoryFilterMode: 'include',
			chains: [],
			categories: [],
			groupBy: 'protocol',
			limit: 10,
			chartType: 'line',
			displayAs: 'timeSeries'
		},
		grouping: 'day',
		timePeriod: 'all',
		customTimePeriod: null,
		filename: 'perps.csv',
		...overrides
	}
}

async function renderCsv(exportRequest: ChartBuilderCsvRequest, base: ProtocolBreakdownBase): Promise<string> {
	const output = new PassThrough()
	let csv = ''
	output.on('data', (chunk) => {
		csv += chunk
	})
	await writeAdapterMetricProtocolCsv(exportRequest, base, lookup, output)
	output.end()
	return csv.trim()
}

describe('writeAdapterMetricProtocolCsv', () => {
	it('keeps protocols that exist only in older history and never emits Others', async () => {
		const csv = await renderCsv(request(), {
			chainsArray: ['all'],
			metricName: 'perps volume',
			chainResultsCount: 1,
			totalDataChartBreakdown: [
				[day, { 'Ended Protocol': 5 }],
				[2 * day, { 'Current Protocol': 10 }]
			]
		})

		expect(csv.split('\n')[0]).toBe('Date,Current Protocol,Ended Protocol')
		expect(csv).not.toContain('Others')
		expect(csv.split('\n')).toEqual(['Date,Current Protocol,Ended Protocol', '1970-01-02,0,5', '1970-01-03,10,0'])
	})

	it('uses the final snapshot in a grouped open-interest period', async () => {
		const csv = await renderCsv(
			{
				...request(),
				config: { ...request().config, metric: 'open-interest' },
				grouping: 'month'
			},
			{
				chainsArray: ['all'],
				metricName: 'open interest',
				chainResultsCount: 1,
				totalDataChartBreakdown: [
					[day, { Protocol: 5 }],
					[2 * day, { Protocol: 8 }]
				]
			}
		)

		expect(csv.split('\n')).toEqual(['Date,Protocol', '1970-01-01,8'])
	})
})
