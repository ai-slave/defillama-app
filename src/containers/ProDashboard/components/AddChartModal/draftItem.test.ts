import { describe, expect, test } from 'vitest'
import type { DashboardItemConfig } from '../../dashboardItemConfig'
import type { ChartConfig, MetricConfig } from '../../types'
import { initializeFromEditItem } from './modalReducer'
import { buildNewDashboardItems } from './modalSubmissions'
import type { ModalState } from './types'

const idFactory = (kind: string, identity: string) => `new:${kind}:${identity}`

function buildFromDraft(draft: DashboardItemConfig): Array<DashboardItemConfig> {
	const state: ModalState = initializeFromEditItem(draft)
	return buildNewDashboardItems({ state, protocols: [], chains: [], existingItems: [], idFactory })
}

const chartDraft = {
	id: 'quick-add-draft',
	kind: 'chart',
	subjectType: 'protocol',
	protocol: 'uniswap',
	type: 'fees',
	grouping: 'day',
	colSpan: 1
} satisfies ChartConfig

const chainChartDraft = {
	id: 'quick-add-draft',
	kind: 'chart',
	subjectType: 'chain',
	chain: 'Ethereum',
	type: 'tvl',
	colSpan: 1
} satisfies ChartConfig

const metricDraft = {
	id: 'quick-add-draft',
	kind: 'metric',
	subject: { itemType: 'protocol', protocol: 'uniswap' },
	type: 'fees',
	aggregator: 'sum',
	window: '30d',
	compare: { mode: 'previous_value', format: 'percent' },
	chartType: 'sparkline',
	label: 'Uniswap fees',
	colSpan: 0.5
} satisfies MetricConfig

describe('initializeFromEditItem as a quick add draft', () => {
	test('opens a chart draft on the protocol tab with the entity and metric selected', () => {
		const state = initializeFromEditItem(chartDraft)

		expect(state.selectedMainTab).toBe('charts')
		expect(state.chartMode).toBe('manual')
		expect(state.selectedChartTab).toBe('protocol')
		expect(state.manualFormOpen).toBe(true)
		expect(state.chartCreationMode).toBe('separate')
		expect(state.selectedProtocol).toBe('uniswap')
		expect(state.selectedChain).toBe(null)
		expect(state.selectedChartType).toBe('fees')
		expect(state.selectedChartTypes).toEqual(['fees'])
		expect(state.composerItems).toEqual([chartDraft])
	})

	test('opens a text draft on the text tab with empty content', () => {
		const state = initializeFromEditItem({ id: 'quick-add-draft', kind: 'text', content: '', colSpan: 1 })

		expect(state.selectedMainTab).toBe('text')
		expect(state.textTitle).toBe('')
		expect(state.textContent).toBe('')
	})

	test('opens a metric draft on the metric tab with its aggregator and window', () => {
		const state = initializeFromEditItem(metricDraft)

		expect(state.selectedMainTab).toBe('metric')
		expect(state.metricSubjectType).toBe('protocol')
		expect(state.metricProtocol).toBe('uniswap')
		expect(state.metricChain).toBe(null)
		expect(state.metricType).toBe('fees')
		expect(state.metricAggregator).toBe('sum')
		expect(state.metricWindow).toBe('30d')
		expect(state.metricChartType).toBe('sparkline')
		expect(state.metricLabel).toBe('Uniswap fees')
	})
})

describe('buildNewDashboardItems from a quick add draft', () => {
	test('rebuilds a protocol chart draft unchanged apart from a fresh id', () => {
		expect(buildFromDraft(chartDraft)).toEqual([{ ...chartDraft, id: 'new:fees:uniswap' }])
	})

	test('rebuilds a chain chart draft unchanged apart from a fresh id', () => {
		expect(buildFromDraft(chainChartDraft)).toEqual([{ ...chainChartDraft, id: 'new:tvl:Ethereum' }])
	})

	test('keeps a groupable chart daily and leaves a non groupable chart ungrouped', () => {
		const [chart] = buildFromDraft(chartDraft) as [ChartConfig]
		const [chainChart] = buildFromDraft(chainChartDraft) as [ChartConfig]

		expect(chart.grouping).toBe('day')
		expect(chainChart.grouping).toBeUndefined()
	})

	test('carries a chart draft colour through the composer', () => {
		expect(buildFromDraft({ ...chartDraft, color: '#ff0080' })).toEqual([
			{ ...chartDraft, id: 'new:fees:uniswap', color: '#ff0080' }
		])
	})

	test('the composer keeps showCumulative and a non daily grouping from a chart draft', () => {
		expect(buildFromDraft({ ...chartDraft, grouping: 'week', showCumulative: true })).toEqual([
			{ ...chartDraft, id: 'new:fees:uniswap', grouping: 'week', showCumulative: true }
		])
	})

	test('a non groupable chart draft stays ungrouped while keeping showCumulative', () => {
		expect(buildFromDraft({ ...chainChartDraft, showCumulative: true })).toEqual([
			{ ...chainChartDraft, id: 'new:tvl:Ethereum', showCumulative: true }
		])
	})

	test('rebuilds a metric draft unchanged apart from a fresh id', () => {
		expect(buildFromDraft(metricDraft)).toEqual([{ ...metricDraft, id: 'new:metric:' }])
	})

	test('an unlabelled metric draft comes back with an empty label', () => {
		const { label: _label, ...unlabelled } = metricDraft

		expect(buildFromDraft(unlabelled)).toEqual([{ ...unlabelled, id: 'new:metric:', label: '' }])
	})
})
