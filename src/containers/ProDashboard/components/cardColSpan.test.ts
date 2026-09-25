import { expect, test } from 'vitest'
import { gridColumnSpan, itemColSpan, itemColSpanOptions, itemSpansFullRow } from './cardColSpan'

const metric = {
	id: 'metric-1',
	kind: 'metric',
	subject: { itemType: 'chain', chain: 'Ethereum' },
	type: 'tvl',
	aggregator: 'latest',
	window: '30d',
	chartType: 'none'
} as const

test('the card menu offers every width to charts and text, the narrow ones to metrics, and none to full-width items', () => {
	expect(itemColSpanOptions({ id: 'text-1', kind: 'text', content: 'Notes' })).toEqual([0.5, 1, 1.5, 2])
	expect(
		itemColSpanOptions({ id: 'chart-1', kind: 'chart', type: 'tvl', subjectType: 'chain', chain: 'Ethereum' })
	).toEqual([0.5, 1, 1.5, 2])
	expect(itemColSpanOptions(metric)).toEqual([0.5, 1])
	expect(
		itemColSpanOptions({ id: 'table', kind: 'dataset-table', datasetType: 'stablecoins', chain: 'Ethereum' })
	).toEqual([])
	expect(itemColSpanOptions({ id: 'section-1', kind: 'section', title: 'Overview', displayAs: 'heading' })).toEqual([])
})

test('a card without a saved width is half the grid, a metric a quarter, and a section the whole row', () => {
	expect(gridColumnSpan(itemColSpan({ id: 'text-1', kind: 'text', content: 'Notes' }))).toBe(2)
	expect(gridColumnSpan(itemColSpan(metric))).toBe(1)
	expect(gridColumnSpan(itemColSpan({ id: 'text-2', kind: 'text', content: 'Wide', colSpan: 1.5 }))).toBe(3)
	expect(
		gridColumnSpan(itemColSpan({ id: 'section-1', kind: 'section', title: 'Overview', displayAs: 'heading' }))
	).toBe(4)
})

test('only a dataset table takes the whole grid row regardless of its stored width', () => {
	expect(
		itemSpansFullRow({ id: 'table', kind: 'dataset-table', datasetType: 'stablecoins', chain: 'Ethereum', colSpan: 1 })
	).toBe(true)
	expect(itemSpansFullRow({ id: 'text-1', kind: 'text', content: 'Notes', colSpan: 2 })).toBe(false)
	expect(itemSpansFullRow(metric)).toBe(false)
})
