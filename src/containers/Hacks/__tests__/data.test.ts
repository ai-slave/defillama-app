import { describe, expect, test } from 'vitest'
import { buildHacksPageSummary, filterHacksRows, type HacksFilterState } from '../data'
import type { IHackRow } from '../types'

const row = (overrides: Partial<IHackRow> = {}): IHackRow => ({
	chains: ['Ethereum'],
	classification: 'Protocol Logic',
	date: 1_704_067_200,
	target: 'DeFi Protocol',
	amountUsd: 0,
	name: 'Protocol',
	technique: 'Key Compromise',
	bridge: false,
	language: '',
	...overrides
})

const filters = (overrides: Partial<HacksFilterState> = {}): HacksFilterState => ({
	chainKeys: undefined,
	techKeys: undefined,
	classKeys: undefined,
	chainIncludeNone: false,
	techIncludeNone: false,
	classIncludeNone: false,
	since: null,
	minLost: null,
	maxLost: null,
	...overrides
})

describe('Hacks data', () => {
	test('keeps incident nulls unavailable while additive summaries use zero contribution', () => {
		const summary = buildHacksPageSummary([
			row({ amountUsd: null, chains: ['Unknown Chain'], technique: 'Unknown', bridge: true }),
			row({ amountUsd: 0 }),
			row({ amountUsd: 250_000 })
		])

		expect(summary.totalHacked).toBe('$250,000')
		expect(summary.totalHackedDefi).toBe('$250,000')
		expect(summary.totalRugs).toBe('$0')
		expect(summary.chainOptions).toContain('Unknown Chain')
		expect(summary.techniqueOptions).toContain('Unknown')
	})

	test('excludes null dates from monthly data without removing their categories', () => {
		const summary = buildHacksPageSummary([
			row({ date: null, amountUsd: 10, classification: 'Missing Date' }),
			row({ amountUsd: 20 })
		])

		expect(summary.totalHacked).toBe('$30')
		expect(summary.monthlyHacksChartData.dataset.source).toHaveLength(1)
		expect(summary.classificationOptions).toContain('Missing Date')
	})

	test('keeps unknown losses for categorical filters and excludes them from numeric ranges', () => {
		const unknown = row({ name: 'Unknown', amountUsd: null })
		const zero = row({ name: 'Zero', amountUsd: 0 })
		const measured = row({ name: 'Measured', amountUsd: 10 })
		const data = [unknown, zero, measured]

		expect(filterHacksRows(data, filters())).toEqual(data)
		expect(filterHacksRows(data, filters({ maxLost: 0 }))).toEqual([zero])
		expect(filterHacksRows(data, filters({ minLost: 1 }))).toEqual([measured])
	})

	test('excludes unknown dates only when a time range is active', () => {
		const unknownDate = row({ name: 'Unknown date', date: null })
		const dated = row({ name: 'Dated' })

		expect(filterHacksRows([unknownDate, dated], filters())).toEqual([unknownDate, dated])
		expect(filterHacksRows([unknownDate, dated], filters({ since: 1_700_000_000 }))).toEqual([dated])
	})

	test('returns measured zero summaries for successful empty data', () => {
		const summary = buildHacksPageSummary([])

		expect(summary.totalHacked).toBe('$0')
		expect(summary.monthlyHacksChartData.dataset.source).toEqual([])
		expect(summary.pieChartData).toEqual([])
	})
})
