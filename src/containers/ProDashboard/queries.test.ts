import { describe, expect, it } from 'vitest'
import { getProDashboardChartSourceQueryKey } from './chartSource'
import { buildProDashboardChartObserverPlan, filterDataByTimePeriod } from './queries'

const data: [number, number][] = [
	[10, 1],
	[20, 2],
	[20, 3],
	[30, 4],
	[40, 5]
]

describe('filterDataByTimePeriod', () => {
	it('slices ascending data with inclusive bounds and duplicate timestamps', () => {
		expect(
			filterDataByTimePeriod(data, 'custom', {
				type: 'absolute',
				startDate: 20,
				endDate: 30
			})
		).toEqual([
			[20, 2],
			[20, 3],
			[30, 4]
		])
	})

	it('reuses the source for all-time and full-range selections', () => {
		expect(filterDataByTimePeriod(data, 'all')).toBe(data)
		expect(
			filterDataByTimePeriod(data, 'custom', {
				type: 'absolute',
				startDate: 0,
				endDate: 100
			})
		).toBe(data)
	})

	it('returns an empty slice when the selected period has no rows', () => {
		expect(
			filterDataByTimePeriod(data, 'custom', {
				type: 'absolute',
				startDate: 50,
				endDate: 60
			})
		).toEqual([])
	})
})

describe('Pro dashboard chart query identities', () => {
	it('shares a metric card with the equivalent raw chart source', () => {
		expect(
			getProDashboardChartSourceQueryKey({
				type: 'chainPrice',
				subjectType: 'chain',
				chain: 'Ethereum',
				geckoId: 'ethereum'
			})
		).toEqual(['pro-dashboard', 'chart-source', 'chainPrice', 'chain', 'Ethereum', 'ethereum', null])
	})

	it('keeps only source-relevant metadata in the key', () => {
		const fees = getProDashboardChartSourceQueryKey({
			type: 'fees',
			subjectType: 'protocol',
			protocol: 'aave',
			geckoId: 'irrelevant',
			dataType: 'realtime'
		})
		expect(fees).toEqual(['pro-dashboard', 'chart-source', 'fees', 'protocol', 'aave', null, null])

		const tokenPrice = getProDashboardChartSourceQueryKey({
			type: 'tokenPrice',
			subjectType: 'protocol',
			protocol: 'aave',
			geckoId: 'aave'
		})
		expect(tokenPrice[5]).toBe('aave')
	})

	it('canonicalizes the default unlock source while keeping realtime separate', () => {
		const omitted = getProDashboardChartSourceQueryKey({
			type: 'unlocks',
			subjectType: 'protocol',
			protocol: 'aave'
		})
		const documented = getProDashboardChartSourceQueryKey({
			type: 'unlocks',
			subjectType: 'protocol',
			protocol: 'aave',
			dataType: 'documented'
		})
		const realtime = getProDashboardChartSourceQueryKey({
			type: 'unlocks',
			subjectType: 'protocol',
			protocol: 'aave',
			dataType: 'realtime'
		})

		expect(omitted).toEqual(documented)
		expect(realtime).not.toEqual(documented)
	})
})

describe('Pro dashboard chart observer planning', () => {
	it('observes each raw source once while preserving every card mapping', () => {
		const plan = buildProDashboardChartObserverPlan([
			{ id: 'daily', kind: 'chart', subjectType: 'protocol', type: 'fees', protocol: 'aave', grouping: 'day' },
			{ id: 'monthly', kind: 'chart', subjectType: 'protocol', type: 'fees', protocol: 'aave', grouping: 'month' },
			{ id: 'active-a', kind: 'chart', subjectType: 'chain', type: 'activeUsers', chain: 'Ethereum' },
			{ id: 'active-b', kind: 'chart', subjectType: 'chain', type: 'activeUsers', chain: 'Ethereum' },
			{ id: 'new', kind: 'chart', subjectType: 'chain', type: 'newUsers', chain: 'Ethereum' }
		])

		expect(plan.sources.map((source) => source.id)).toEqual(['daily', 'active-a', 'new'])
		expect(plan.sourceIndexByChart).toEqual([0, 0, 1, 1, 2])
	})
})
