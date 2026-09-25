import { describe, expect, test } from 'vitest'
import { parseChartBuilderCsvRequest } from '../chartBuilderCsvContract'

const validRequest = {
	config: {
		metric: 'perps',
		mode: 'chains',
		chainFilterMode: 'include',
		categoryFilterMode: 'exclude',
		chainCategoryFilterMode: 'include',
		protocolCategoryFilterMode: 'include',
		chains: ['Ethereum'],
		chainCategories: [],
		protocolCategories: [],
		categories: ['Derivatives'],
		groupBy: 'protocol',
		limit: 10,
		chartType: 'line',
		displayAs: 'timeSeries',
		groupByParent: true
	},
	grouping: 'quarter',
	timePeriod: 'custom',
	customTimePeriod: { type: 'absolute', startDate: 100, endDate: 200 },
	filename: 'perps.csv'
}

describe('parseChartBuilderCsvRequest', () => {
	test('accepts the typed Chart Builder export contract', () => {
		expect(parseChartBuilderCsvRequest(validRequest)).toEqual(validRequest)
	})

	test('rejects unsupported metrics before invoking an export source', () => {
		expect(() =>
			parseChartBuilderCsvRequest({ ...validRequest, config: { ...validRequest.config, metric: 'unknown' } })
		).toThrow('Unsupported Chart Builder metric')
	})

	test('rejects metric and grouping combinations that Chart Builder cannot produce', () => {
		expect(() =>
			parseChartBuilderCsvRequest({
				...validRequest,
				config: { ...validRequest.config, metric: 'chain-fees', mode: 'chains' }
			})
		).toThrow('chain-fees can only be grouped by chain')
	})

	test('rejects invalid filter sizes and date ranges', () => {
		expect(() =>
			parseChartBuilderCsvRequest({
				...validRequest,
				config: { ...validRequest.config, chains: Array.from({ length: 51 }, (_, index) => `Chain ${index}`) }
			})
		).toThrow('config.chains must be an array of at most 50 strings')
		expect(() =>
			parseChartBuilderCsvRequest({
				...validRequest,
				customTimePeriod: { type: 'absolute', startDate: 200, endDate: 100 }
			})
		).toThrow('customTimePeriod requires a valid startDate and endDate')
	})
})
