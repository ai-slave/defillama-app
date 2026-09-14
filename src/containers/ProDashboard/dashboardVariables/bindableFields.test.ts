import { describe, expect, test } from 'vitest'
import { migrateDashboardItemConfig } from '../dashboardConfig/migrate'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import type { ChartBuilderConfig, DashboardBindableField, DashboardItemBindings } from '../types'
import {
	DASHBOARD_ITEM_BINDABLE_FIELDS,
	getBindableFieldVariableKind,
	getBindableFields,
	getDashboardItemBindings,
	isBindableDashboardItem,
	sanitizeDashboardItemBindings
} from './bindableFields'

const ALL_KINDS: Array<DashboardItemConfig['kind']> = [
	'chart',
	'multi',
	'metric',
	'unified-table',
	'builder',
	'stablecoins',
	'advanced-tvl',
	'advanced-borrowed',
	'income-statement',
	'unlocks-schedule',
	'unlocks-pie',
	'dataset-table',
	'text',
	'yields',
	'stablecoin-asset',
	'llamaai-chart',
	'rwa-overview',
	'rwa-asset',
	'sql',
	'section',
	'custom-data'
]

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
const protocolCards: Array<DashboardItemConfig> = [
	{ id: 'a', kind: 'advanced-tvl', protocol: 'aave', protocolName: 'Aave', chartType: 'tvl' },
	{ id: 'b', kind: 'advanced-borrowed', protocol: 'aave', protocolName: 'Aave', chartType: 'chainsBorrowed' },
	{ id: 'i', kind: 'income-statement', protocol: 'aave', protocolName: 'Aave' },
	{ id: 'u', kind: 'unlocks-schedule', protocol: 'aave', protocolName: 'Aave', dataType: 'documented' },
	{ id: 'up', kind: 'unlocks-pie', protocol: 'aave', protocolName: 'Aave', chartType: 'allocation' }
]
const unbindable: Array<DashboardItemConfig> = [
	{ id: 'text', kind: 'text', content: 'hello' },
	{ id: 'section', kind: 'section', title: 'Section', displayAs: 'heading' },
	{ id: 'multi', kind: 'multi', items: [] },
	{
		id: 'custom',
		kind: 'custom-data',
		name: 'Uploaded',
		columns: [],
		chart: {
			chartType: 'bar',
			xCol: null,
			yCols: [],
			splitByCol: null,
			stackMode: 'off',
			rightAxisCols: [],
			seriesKinds: {},
			seriesColors: {},
			numberFormat: 'auto'
		},
		displayMode: 'table'
	}
]

describe('DASHBOARD_ITEM_BINDABLE_FIELDS', () => {
	test('has an entry for every dashboard item kind', () => {
		expect(Object.keys(DASHBOARD_ITEM_BINDABLE_FIELDS).sort()).toEqual([...ALL_KINDS].sort())
	})

	test('only the documented kinds expose fields', () => {
		const bindable = Object.entries(DASHBOARD_ITEM_BINDABLE_FIELDS)
			.filter(([, fields]) => Object.keys(fields).length > 0)
			.map(([kind]) => kind)
			.sort()
		expect(bindable).toEqual(
			[
				'chart',
				'metric',
				'unified-table',
				'builder',
				'stablecoins',
				'advanced-tvl',
				'advanced-borrowed',
				'income-statement',
				'unlocks-schedule',
				'unlocks-pie'
			].sort()
		)
	})
})

describe('getBindableFields', () => {
	test.each<[string, DashboardItemConfig, Array<DashboardBindableField>]>([
		['chain chart', chainChart, ['subject']],
		['protocol chart', protocolChart, ['subject']],
		['chain metric', chainMetric, ['subject']],
		['protocol metric', protocolMetric, ['subject']],
		['unified-table', table, ['chains']],
		['builder in chains mode', builder('chains'), ['chains']],
		['builder in protocol mode', builder('protocol'), ['chains', 'protocol']],
		['stablecoins', stablecoins, ['chain']],
		...protocolCards.map((card): [string, DashboardItemConfig, Array<DashboardBindableField>] => [
			card.kind,
			card,
			['protocol']
		]),
		...unbindable.map((item): [string, DashboardItemConfig, Array<DashboardBindableField>] => [item.kind, item, []])
	])('%s', (_label, item, fields) => {
		expect(getBindableFields(item)).toEqual(fields)
		expect(isBindableDashboardItem(item)).toBe(Object.keys(DASHBOARD_ITEM_BINDABLE_FIELDS[item.kind]).length > 0)
	})
})

describe('getBindableFieldVariableKind', () => {
	test('subject fields follow the current subject type', () => {
		expect(getBindableFieldVariableKind(chainChart, 'subject')).toBe('chain')
		expect(getBindableFieldVariableKind(protocolChart, 'subject')).toBe('protocol')
		expect(getBindableFieldVariableKind(chainMetric, 'subject')).toBe('chain')
		expect(getBindableFieldVariableKind(protocolMetric, 'subject')).toBe('protocol')
	})

	test('fixed-kind fields report their kind and unknown fields are null', () => {
		expect(getBindableFieldVariableKind(table, 'chains')).toBe('chain')
		expect(getBindableFieldVariableKind(table, 'subject')).toBeNull()
		expect(getBindableFieldVariableKind(stablecoins, 'chain')).toBe('chain')
		expect(getBindableFieldVariableKind(protocolCards[0]!, 'protocol')).toBe('protocol')
		expect(getBindableFieldVariableKind(protocolCards[0]!, 'chain')).toBeNull()
		expect(getBindableFieldVariableKind(unbindable[0]!, 'subject')).toBeNull()
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
		expect(sanitizeDashboardItemBindings(unbindable[0]!, { subject: 'chain' })).toBeUndefined()
	})

	test('sanitized output is assignable to DashboardItemBindings', () => {
		const bindings: DashboardItemBindings | undefined = sanitizeDashboardItemBindings(protocolCards[2]!, {
			protocol: 'protocol'
		})
		expect(bindings).toEqual({ protocol: 'protocol' })
	})
})

describe('getDashboardItemBindings', () => {
	test('returns the card own bindings or an empty object', () => {
		expect(getDashboardItemBindings(chainChart)).toEqual({})
		expect(getDashboardItemBindings({ ...chainChart, bindings: { subject: 'chain' } })).toEqual({ subject: 'chain' })
		expect(getDashboardItemBindings(unbindable[0]!)).toEqual({})
	})

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
