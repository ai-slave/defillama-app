import { describe, expect, test } from 'vitest'
import { migrateDashboardItemConfig } from '../dashboardConfig/migrate'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import type { ChartBuilderConfig } from '../types'
import {
	getBindableFieldVariableKind,
	getBindableFields,
	getDashboardItemBindings,
	sanitizeDashboardItemBindings
} from './bindableFields'

function builder(mode: ChartBuilderConfig['config']['mode']): ChartBuilderConfig {
	return {
		id: 'builder',
		kind: 'builder',
		config: {
			metric: 'fees',
			mode,
			chainFilterMode: 'include',
			categoryFilterMode: 'include',
			chainCategoryFilterMode: 'include',
			protocolCategoryFilterMode: 'include',
			...(mode === 'protocol' ? { protocol: 'aave' } : {}),
			chains: [],
			categories: [],
			groupBy: 'protocol',
			limit: 10,
			chartType: 'stackedBar',
			displayAs: 'timeSeries'
		}
	}
}

const chainChart: DashboardItemConfig = { id: 'c', kind: 'chart', subjectType: 'chain', chain: 'Ethereum', type: 'tvl' }
const protocolChart: DashboardItemConfig = {
	id: 'p',
	kind: 'chart',
	subjectType: 'protocol',
	protocol: 'aave',
	type: 'fees'
}
const chainMetric: DashboardItemConfig = {
	id: 'm',
	kind: 'metric',
	subject: { itemType: 'chain', chain: 'Ethereum' },
	type: 'tvl',
	aggregator: 'latest',
	window: '30d',
	chartType: 'none'
}
const protocolMetric: DashboardItemConfig = {
	id: 'pm',
	kind: 'metric',
	subject: { itemType: 'protocol', protocol: 'aave' },
	type: 'fees',
	aggregator: 'latest',
	window: '30d',
	chartType: 'none'
}
const table: DashboardItemConfig = {
	id: 't',
	kind: 'unified-table',
	configVersion: 3,
	strategy: 'protocols',
	rowHeaders: ['protocol']
}
const stablecoins: DashboardItemConfig = { id: 's', kind: 'stablecoins', chain: 'Ethereum', chartType: 'totalMcap' }
const advancedTvl: DashboardItemConfig = {
	id: 'a',
	kind: 'advanced-tvl',
	protocol: 'aave',
	protocolName: 'Aave',
	chartType: 'tvl'
}
const textCard: DashboardItemConfig = { id: 'text', kind: 'text', content: 'hello' }

describe('getBindableFields', () => {
	test('a builder binds its protocol only in protocol mode', () => {
		expect(getBindableFields(builder('chains'))).toEqual(['chains'])
		expect(getBindableFields(builder('protocol'))).toEqual(['chains', 'protocol'])
	})
})

describe('getBindableFieldVariableKind', () => {
	test('subject fields follow the current subject type', () => {
		expect(getBindableFieldVariableKind(chainChart, 'subject')).toBe('chain')
		expect(getBindableFieldVariableKind(protocolChart, 'subject')).toBe('protocol')
		expect(getBindableFieldVariableKind(chainMetric, 'subject')).toBe('chain')
		expect(getBindableFieldVariableKind(protocolMetric, 'subject')).toBe('protocol')
	})

	test('a field the card cannot bind has no variable kind', () => {
		expect(getBindableFieldVariableKind(advancedTvl, 'chain')).toBeNull()
	})

	test('builder protocol is bindable only in protocol mode', () => {
		expect(getBindableFieldVariableKind(builder('protocol'), 'protocol')).toBe('protocol')
		expect(getBindableFieldVariableKind(builder('chains'), 'protocol')).toBeNull()
		expect(getBindableFieldVariableKind(builder('chains'), 'chains')).toBe('chain')
		expect(getBindableFieldVariableKind(builder('protocol'), 'chains')).toBe('chain')
	})
})

describe('sanitizeDashboardItemBindings', () => {
	test('keeps only known string bindings for the item kind', () => {
		const raw = { subject: 'chain', chains: 'chain', protocol: 42, chain: '', extra: 'x' }
		expect(sanitizeDashboardItemBindings(chainChart, raw)).toEqual({ subject: 'chain' })
		expect(sanitizeDashboardItemBindings(table, raw)).toEqual({ chains: 'chain' })
		expect(sanitizeDashboardItemBindings(builder('chains'), raw)).toEqual({ chains: 'chain' })
		expect(sanitizeDashboardItemBindings(stablecoins, raw)).toBeUndefined()
	})

	test('returns undefined for empty, non-object or unbindable input', () => {
		expect(sanitizeDashboardItemBindings(chainChart, {})).toBeUndefined()
		expect(sanitizeDashboardItemBindings(chainChart, null)).toBeUndefined()
		expect(sanitizeDashboardItemBindings(chainChart, ['subject'])).toBeUndefined()
		expect(sanitizeDashboardItemBindings(chainChart, 'subject')).toBeUndefined()
		expect(sanitizeDashboardItemBindings(textCard, { subject: 'chain' })).toBeUndefined()
	})
})

describe('getDashboardItemBindings', () => {
	test('unions the sub-chart bindings of a multi card', () => {
		expect(
			getDashboardItemBindings({
				id: 'multi',
				kind: 'multi',
				items: [
					{ id: 'a', kind: 'chart', subjectType: 'chain', chain: 'Ethereum', type: 'tvl' },
					{
						id: 'b',
						kind: 'chart',
						subjectType: 'protocol',
						protocol: 'aave',
						type: 'fees',
						bindings: { subject: 'protocol' }
					}
				]
			})
		).toEqual({ subject: 'protocol' })
		expect(getDashboardItemBindings({ id: 'multi', kind: 'multi', items: [] })).toEqual({})
		expect(getDashboardItemBindings(chainChart)).toEqual({})
		expect(getDashboardItemBindings({ ...chainChart, bindings: { subject: 'chain' } })).toEqual({ subject: 'chain' })
	})

	test('migration keeps multi sub-chart bindings and drops unknown fields', () => {
		const migrated = migrateDashboardItemConfig({
			id: 'multi',
			kind: 'multi',
			items: [
				{
					id: 'a',
					kind: 'chart',
					subjectType: 'chain',
					chain: 'Ethereum',
					type: 'tvl',
					bindings: { subject: 'chain', protocol: 'protocol' }
				} as never,
				{ id: 'b', kind: 'chart', subjectType: 'protocol', protocol: 'aave', type: 'fees' }
			]
		})
		expect(getDashboardItemBindings(migrated!)).toEqual({ subject: 'chain' })
		expect(migrateDashboardItemConfig({ id: 'multi', kind: 'multi', items: [] })).toBeNull()
	})
})
