import { PassThrough } from 'node:stream'
import { describe, expect, test } from 'vitest'
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
	test('keeps protocols that exist only in older history and never emits Others', async () => {
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

	test('uses the final snapshot in a grouped open-interest period', async () => {
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

		expect(csv.split('\n')).toEqual(['Month start,Month end,Protocol', '1970-01-01,1970-01-31,8'])
	})
})

test.each([
	['perps', '3,6,9,12,15,18,21,24,27,30,33,36,39,42,45,48,51,54,57,60,63,66,69,72,75,78,81,84,87,90,93,96'],
	['open-interest', '2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,60,62,64']
] as const)(
	'%s exports more than thirty protocols and respects flow versus snapshot grouping',
	async (metric, values) => {
		const names = Array.from({ length: 32 }, (_, index) => `P${String(index + 1).padStart(2, '0')}`)
		const csv = await renderCsv(
			{ ...request(), grouping: 'month', config: { ...request().config, metric, limit: 1 } },
			{
				chainsArray: ['all'],
				metricName: metric,
				chainResultsCount: 1,
				totalDataChartBreakdown: [
					[day, Object.fromEntries(names.map((name, index) => [name, index + 1]))],
					[2 * day, Object.fromEntries(names.map((name, index) => [name, 2 * (index + 1)]))]
				]
			}
		)
		expect(csv).toBe(
			`Month start,Month end,P01,P02,P03,P04,P05,P06,P07,P08,P09,P10,P11,P12,P13,P14,P15,P16,P17,P18,P19,P20,P21,P22,P23,P24,P25,P26,P27,P28,P29,P30,P31,P32\n1970-01-01,1970-01-31,${values}`
		)
	}
)
