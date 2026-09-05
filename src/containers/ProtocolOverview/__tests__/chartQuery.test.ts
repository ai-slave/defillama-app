import { describe, expect, it } from 'vitest'
import {
	resolveProtocolChartDenomination,
	resolveProtocolChartQuery,
	type ProtocolChartQueryKey,
	type ProtocolChartQueryValue
} from '../chartQuery'
import type { ProtocolChartsLabels } from '../constants'

const resolveQuery = ({
	query = {},
	availableCharts = ['TVL', 'Fees', 'Staking'],
	defaultToggledCharts = ['Fees'],
	hallmarks = [],
	rangeHallmarks = [],
	defaultChartView = 'weekly'
}: {
	query?: Partial<Record<ProtocolChartQueryKey, ProtocolChartQueryValue>>
	availableCharts?: ProtocolChartsLabels[]
	defaultToggledCharts?: ProtocolChartsLabels[]
	hallmarks?: Array<[number, string]>
	rangeHallmarks?: Array<[[number, number], string]>
	defaultChartView?: string
} = {}) =>
	resolveProtocolChartQuery({
		getQueryValue: (key) => query[key],
		availableCharts,
		defaultToggledCharts,
		chartDenominations: [{ symbol: 'USD' }, { symbol: 'ETH' }],
		hallmarks,
		rangeHallmarks,
		defaultChartView
	})

const eventCases: Array<{
	hallmarks: Array<[number, string]>
	rangeHallmarks: Array<[[number, number], string]>
}> = [
	{ hallmarks: [[1, 'point']], rangeHallmarks: [] },
	{ hallmarks: [], rangeHallmarks: [[[1, 2], 'range']] }
]

describe('protocol chart query resolution', () => {
	it('ignores retired governance toggles in saved URLs while honoring supported charts', () => {
		const query = { totalProposals: 'true', successfulProposals: 'true', maxVotes: 'true', tvl: 'true' }
		const result = resolveQuery({ query })

		expect(result.toggledCharts).toEqual(['TVL', 'Fees'])
		expect(result.toggledMetrics).not.toHaveProperty('totalProposals')
		expect(result.toggledMetrics).not.toHaveProperty('successfulProposals')
		expect(result.toggledMetrics).not.toHaveProperty('maxVotes')
	})

	it.each(eventCases)(
		'defaults events on for either point or range hallmarks and honors explicit visibility',
		(events) => {
			expect(resolveQuery(events).toggledMetrics.events).toBe('true')
			expect(resolveQuery({ ...events, query: { events: 'true' } }).toggledMetrics.events).toBe('true')
			expect(resolveQuery({ ...events, query: { events: 'false' } }).toggledMetrics.events).toBe('false')
		}
	)

	it('keeps events off when the protocol has no event data', () => {
		expect(resolveQuery({ query: { events: 'true' } }).toggledMetrics.events).toBe('false')
	})

	it('uses the producer default chart interval when absent and a valid explicit override when present', () => {
		expect(resolveQuery().groupBy).toBe('weekly')
		expect(resolveQuery({ query: { groupBy: 'Monthly' } }).groupBy).toBe('monthly')
		expect(resolveQuery({ query: { groupBy: ['monthly'] } }).groupBy).toBe('weekly')
	})

	it('honors explicit non-default TVL while retaining staking as the default chart', () => {
		const result = resolveQuery({
			query: { tvl: 'true' },
			availableCharts: ['TVL', 'Staking'],
			defaultToggledCharts: ['Staking']
		})

		expect(result.toggledMetrics.tvl).toBe('true')
		expect(result.toggledMetrics.staking_tvl).toBe('true')
		expect(result.toggledCharts).toStrictEqual(['TVL', 'Staking'])
	})

	it('canonicalizes supported denomination casing and rejects unsupported or array query values', () => {
		const denominations = [{ symbol: 'USD' }, { symbol: 'ETH' }]

		expect(resolveProtocolChartDenomination('eth', denominations)).toBe('ETH')
		expect(resolveProtocolChartDenomination('btc', denominations)).toBeNull()
		expect(resolveProtocolChartDenomination(['eth'], denominations)).toBeNull()
		expect(resolveQuery({ query: { denomination: 'eth' } }).toggledMetrics.denomination).toBe('ETH')
	})
})
