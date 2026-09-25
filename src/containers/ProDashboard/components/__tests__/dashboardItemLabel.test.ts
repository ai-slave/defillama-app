import { expect, test } from 'vitest'
import type { DashboardItemConfig } from '../../dashboardItemConfig'
import { dashboardItemKindLabel, dashboardItemLabel } from '../dashboardItemLabel'

test('a configured name wins over the kind label', () => {
	const items: Array<[DashboardItemConfig, string]> = [
		[{ id: 'section-1', kind: 'section', title: 'Overview', displayAs: 'heading' }, 'Overview'],
		[{ id: 'text-1', kind: 'text', title: 'Notes', content: 'body' }, 'Notes'],
		[{ id: 'multi-1', kind: 'multi', name: 'Fees vs revenue', items: [] }, 'Fees vs revenue'],
		[{ id: 'chart-1', kind: 'chart', type: 'tvl', subjectType: 'chain', chain: 'Ethereum' }, 'Ethereum'],
		[{ id: 'advanced-tvl-1', kind: 'advanced-tvl', protocol: 'aave', protocolName: 'Aave', chartType: 'tvl' }, 'Aave'],
		[
			{
				id: 'yields-1',
				kind: 'yields',
				poolConfigId: 'pool',
				poolName: 'USDC pool',
				project: 'aave',
				chain: 'Ethereum'
			},
			'USDC pool'
		],
		[
			{
				id: 'metric-1',
				kind: 'metric',
				subject: { itemType: 'protocol', protocol: 'aave' },
				type: 'tvl',
				aggregator: 'latest',
				window: '30d',
				chartType: 'none'
			},
			'aave'
		]
	]
	for (const [item, expected] of items) expect(dashboardItemLabel(item)).toBe(expected)
})

test('a card with nothing configured falls back to its singular kind label', () => {
	expect(dashboardItemLabel({ id: 'multi-1', kind: 'multi', items: [] })).toBe('Multi-chart')
	expect(
		dashboardItemLabel({
			id: 'unified-table-1',
			kind: 'unified-table',
			configVersion: 3,
			strategy: 'protocols',
			rowHeaders: ['protocol']
		})
	).toBe('Table')
	expect(dashboardItemLabel({ id: 'text-1', kind: 'text', title: '  ', content: 'body' })).toBe('Text block')
})

test('kind labels are capitalized without touching an acronym', () => {
	expect(dashboardItemKindLabel('chart')).toBe('Chart')
	expect(dashboardItemKindLabel('advanced-tvl')).toBe('TVL chart')
	expect(dashboardItemKindLabel('sql')).toBe('SQL chart')
})
