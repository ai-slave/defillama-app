import { describe, expect, it } from 'vitest'
import {
	buildProDashboardChartObserverPlan,
	filterDataByTimePeriod,
	getChartCardQueryKey,
	getMetricQueryKey
} from './queries'

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
	it('shares one raw source across cards with different presentation settings', () => {
		const monthly = getChartCardQueryKey({
			type: 'fees',
			protocol: 'aave',
			chain: ''
		})
		const daily = getChartCardQueryKey({
			type: 'fees',
			protocol: 'aave',
			chain: ''
		})

		expect(monthly).toEqual(['pro-dashboard', 'chart-source', 'fees', 'protocol', 'aave', null, null])
		expect(daily).toEqual(monthly)
	})

	it('shares a metric card with the equivalent raw chart source', () => {
		expect(getMetricQueryKey('chainPrice', 'chain', 'Ethereum', 'ethereum')).toEqual([
			'pro-dashboard',
			'chart-source',
			'chainPrice',
			'chain',
			'Ethereum',
			'ethereum',
			null
		])
	})

	it('keeps only source-relevant metadata in the key', () => {
		const fees = getChartCardQueryKey({
			type: 'fees',
			protocol: 'aave',
			chain: '',
			geckoId: 'irrelevant',
			dataType: 'realtime'
		})
		expect(fees).toEqual(['pro-dashboard', 'chart-source', 'fees', 'protocol', 'aave', null, null])

		const tokenPrice = getChartCardQueryKey({
			type: 'tokenPrice',
			protocol: 'aave',
			chain: '',
			geckoId: 'aave'
		})
		expect(tokenPrice[5]).toBe('aave')
	})

	it('canonicalizes the default unlock source while keeping realtime separate', () => {
		const omitted = getChartCardQueryKey({ type: 'unlocks', protocol: 'aave', chain: '' })
		const documented = getChartCardQueryKey({
			type: 'unlocks',
			protocol: 'aave',
			chain: '',
			dataType: 'documented'
		})
		const realtime = getChartCardQueryKey({
			type: 'unlocks',
			protocol: 'aave',
			chain: '',
			dataType: 'realtime'
		})

		expect(omitted).toEqual(documented)
		expect(realtime).not.toEqual(documented)
	})

	it('treats persisted users charts as the active-addresses source', () => {
		const users = getChartCardQueryKey({ type: 'users', protocol: '', chain: 'Ethereum' })
		const activeUsers = getChartCardQueryKey({ type: 'activeUsers', protocol: '', chain: 'Ethereum' })

		expect(users).toEqual(activeUsers)
		expect(activeUsers).toEqual(['pro-dashboard', 'chart-source', 'activeUsers', 'chain', 'Ethereum', null, null])
	})

	it('treats persisted options charts as options premium volume', () => {
		const legacy = getChartCardQueryKey({ type: 'options', protocol: '', chain: 'Ethereum' })
		const premium = getChartCardQueryKey({ type: 'optionsPremium', protocol: '', chain: 'Ethereum' })
		const notional = getChartCardQueryKey({ type: 'optionsNotional', protocol: '', chain: 'Ethereum' })

		expect(legacy).toEqual(premium)
		expect(notional).not.toEqual(premium)
	})
})

describe('Pro dashboard chart observer planning', () => {
	it('observes each raw source once while preserving every card mapping', () => {
		const plan = buildProDashboardChartObserverPlan([
			{ id: 'daily', kind: 'chart', type: 'fees', protocol: 'aave', chain: '', grouping: 'day' },
			{ id: 'monthly', kind: 'chart', type: 'fees', protocol: 'aave', chain: '', grouping: 'month' },
			{ id: 'users', kind: 'chart', type: 'users', protocol: '', chain: 'Ethereum' },
			{ id: 'active', kind: 'chart', type: 'activeUsers', protocol: '', chain: 'Ethereum' },
			{ id: 'new', kind: 'chart', type: 'newUsers', protocol: '', chain: 'Ethereum' }
		])

		expect(plan.sources.map((source) => source.id)).toEqual(['daily', 'users', 'new'])
		expect(plan.sourceIndexByChart).toEqual([0, 0, 1, 1, 2])
	})
})
