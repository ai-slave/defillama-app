import { describe, expect, test } from 'vitest'
import { missingColumnNotices, missingMultiMetricNotices, type MultiMetricSavedConfig } from '../savedDownloads'

describe('missingColumnNotices', () => {
	test('a preset that still matches the loaded headers has nothing to say', () => {
		expect(missingColumnNotices(null)).toEqual([])
		expect(missingColumnNotices({ missingColumns: [], missingSortColumn: null })).toEqual([])
	})

	test('names up to three dropped columns and the dropped sort column', () => {
		expect(missingColumnNotices({ missingColumns: ['fees'], missingSortColumn: null })).toEqual([
			'1 saved column no longer available: fees'
		])
		expect(missingColumnNotices({ missingColumns: ['a', 'b', 'c', 'd'], missingSortColumn: 'tvl' })).toEqual([
			'4 saved columns no longer available: a, b, c…',
			'Saved sort column "tvl" no longer available'
		])
	})
})

describe('missingMultiMetricNotices', () => {
	const config: MultiMetricSavedConfig = {
		id: 'saved',
		createdAt: 1,
		name: 'Saved',
		kind: 'multiMetric',
		paramType: 'chain',
		param: 'ethereum',
		paramLabel: 'Ethereum',
		metrics: ['chain-tvl-chart', 'a', 'b']
	}

	test('a missing param is the only notice, since none of the preset applies', () => {
		expect(
			missingMultiMetricNotices(config, {
				paramType: 'chain',
				param: null,
				metrics: ['chain-tvl-chart'],
				missingParam: true,
				missingMetrics: ['a', 'b']
			})
		).toEqual(['Saved chain "Ethereum" no longer available'])
	})

	test('counts the metrics the saved param no longer offers', () => {
		const applied = { paramType: 'chain' as const, param: { label: 'Ethereum', value: 'ethereum' }, metrics: [] }
		expect(missingMultiMetricNotices(config, { ...applied, missingParam: false, missingMetrics: ['a', 'b'] })).toEqual([
			'2 saved metrics no longer available'
		])
		expect(missingMultiMetricNotices(config, { ...applied, missingParam: false, missingMetrics: [] })).toEqual([])
	})
})
