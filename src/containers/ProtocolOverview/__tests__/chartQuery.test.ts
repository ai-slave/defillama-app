import { describe, expect, test } from 'vitest'
import {
	formatProtocolSummaryValue,
	readAsPathQuery,
	resolveEmbedTvlSettings,
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
	availableCharts?: Array<ProtocolChartsLabels>
	defaultToggledCharts?: Array<ProtocolChartsLabels>
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
	test.each(eventCases)(
		'defaults events on for either point or range hallmarks and honors explicit visibility',
		(events) => {
			expect(resolveQuery(events).toggledMetrics.events).toBe('true')
			expect(resolveQuery({ ...events, query: { events: 'true' } }).toggledMetrics.events).toBe('true')
			expect(resolveQuery({ ...events, query: { events: 'false' } }).toggledMetrics.events).toBe('false')
		}
	)

	test('keeps events off when the protocol has no event data', () => {
		expect(resolveQuery({ query: { events: 'true' } }).toggledMetrics.events).toBe('false')
	})

	test('uses the producer default chart interval when absent and a valid explicit override when present', () => {
		expect(resolveQuery().groupBy).toBe('weekly')
		expect(resolveQuery({ query: { groupBy: 'Monthly' } }).groupBy).toBe('monthly')
		expect(resolveQuery({ query: { groupBy: ['monthly'] } }).groupBy).toBe('weekly')
	})

	test('honors explicit non-default TVL while retaining staking as the default chart', () => {
		const result = resolveQuery({
			query: { tvl: 'true' },
			availableCharts: ['TVL', 'Staking'],
			defaultToggledCharts: ['Staking']
		})

		expect(result.toggledMetrics.tvl).toBe('true')
		expect(result.toggledMetrics.staking_tvl).toBe('true')
		expect(result.toggledCharts).toStrictEqual(['TVL', 'Staking'])
	})

	test('canonicalizes supported denomination casing and rejects unsupported or array query values', () => {
		const denominations = [{ symbol: 'USD' }, { symbol: 'ETH' }]

		expect(resolveProtocolChartDenomination('eth', denominations)).toBe('ETH')
		expect(resolveProtocolChartDenomination('btc', denominations)).toBeNull()
		expect(resolveProtocolChartDenomination(['eth'], denominations)).toBeNull()
		expect(resolveQuery({ query: { denomination: 'eth' } }).toggledMetrics.denomination).toBe('ETH')
	})
})

describe('chart query sources', () => {
	const resolveFromPath = (asPath: string) =>
		resolveProtocolChartQuery({
			getQueryValue: readAsPathQuery(asPath),
			availableCharts: ['TVL', 'Fees'],
			defaultToggledCharts: ['Fees'],
			chartDenominations: [{ symbol: 'USD' }, { symbol: 'ETH' }],
			hallmarks: [[1, 'event']],
			rangeHallmarks: [],
			defaultChartView: 'daily'
		})

	test('treats a repeated path value as invalid instead of taking the first one', () => {
		const { toggledMetrics, groupBy } = resolveFromPath(
			'/protocol/aave?denomination=eth&denomination=usd&events=false&events=true&groupBy=monthly&groupBy=weekly&tvl=true&tvl=false&fees=false&fees=true'
		)
		expect({
			denomination: toggledMetrics.denomination,
			events: toggledMetrics.events,
			tvl: toggledMetrics.tvl,
			fees: toggledMetrics.fees,
			groupBy
		}).toEqual({ denomination: null, events: 'true', tvl: 'false', fees: 'true', groupBy: 'daily' })
	})

	test('reads embedded TVL extras from include params, accepting 1 and true', () => {
		const query: Record<string, string> = {
			include_staking_in_tvl: 'false',
			include_pool2_in_tvl: '1',
			include_borrowed_in_tvl: 'true',
			include_doublecounted_in_tvl: 'true'
		}
		expect(resolveEmbedTvlSettings((key) => query[key])).toEqual({
			staking: false,
			borrowed: true,
			pool2: true,
			vesting: false
		})
	})
})

describe('formatProtocolSummaryValue', () => {
	const eth = { tokenSymbol: 'ETH', tokenPrice: { price: 2, symbol: 'ETH' } }
	test('converts summary values into the selected chain token once its price is known', () => {
		expect(formatProtocolSummaryValue(100, { ...eth, selectedDenomination: 'ETH' })).toBe('50 ETH')
		expect(formatProtocolSummaryValue(5_000_000, { ...eth, selectedDenomination: 'ETH' })).toBe('2.5m ETH')
	})

	test('stays in USD without a selected token, a loaded price, or a usable price', () => {
		expect(formatProtocolSummaryValue(5_000_000, { ...eth, selectedDenomination: null })).toBe('$5m')
		expect(formatProtocolSummaryValue(100, { ...eth, selectedDenomination: 'ETH', tokenPrice: null })).toBe('$100')
		expect(
			formatProtocolSummaryValue(100, { ...eth, selectedDenomination: 'ETH', tokenPrice: { price: 0, symbol: 'ETH' } })
		).toBe('$100')
		expect(formatProtocolSummaryValue(null, { ...eth, selectedDenomination: 'ETH' })).toBeNull()
	})
})
