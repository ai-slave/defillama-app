import { describe, expect, it } from 'vitest'
import { CHART_COLORS } from '~/constants/colors'
import {
	buildTokenUsageTreemapTreeData,
	filterTokenUsageTreemapTreeData,
	getTokenUsageTreemapProtocolOptions,
	getTokenUsageTreemapTotal,
	prepareTokenUsageTreemapCsv
} from './treemap'

describe('buildTokenUsageTreemapTreeData', () => {
	it('aggregates typed values while preserving category, protocol, share, and color ordering', () => {
		const tree = buildTokenUsageTreemapTreeData(
			[
				{ name: 'Beta', amountUsd: 25, category: ' DeFi ' },
				{ name: 'Alpha', amountUsd: 25, category: 'DeFi' },
				{ name: 'Alpha', amountUsd: 50, category: 'DeFi' },
				{ name: 'Desk', amountUsd: 50, category: '' },
				{ name: 'Ignored', amountUsd: 0, category: 'DeFi' }
			],
			'LINK usage'
		)

		expect(tree.map((node) => [node.name, node.value[0]])).toEqual([
			['DeFi', 100],
			['Other', 50]
		])
		expect(tree[0]).toMatchObject({
			path: 'LINK usage/DeFi',
			value: [100, 66.67, 66.67],
			itemStyle: { color: CHART_COLORS[0] }
		})
		expect(tree[0].children).toEqual([
			{
				name: 'Alpha',
				path: 'LINK usage/DeFi/Alpha',
				selectorKey: '["DeFi","Alpha"]',
				value: [75, 75, 50],
				itemStyle: { color: 'rgb(58, 121, 215)' }
			},
			{
				name: 'Beta',
				path: 'LINK usage/DeFi/Beta',
				selectorKey: '["DeFi","Beta"]',
				value: [25, 25, 16.67],
				itemStyle: { color: 'rgb(134, 173, 231)' }
			}
		])
		expect(tree[1].children?.[0].itemStyle?.color).toBe(CHART_COLORS[1])
	})

	it('returns no nodes when the typed rows have no positive usage', () => {
		expect(
			buildTokenUsageTreemapTreeData([
				{ name: 'Zero', amountUsd: 0, category: 'DeFi' },
				{ name: 'Negative', amountUsd: -10, category: 'DeFi' }
			])
		).toEqual([])
	})

	it('filters exact protocol leaves while preserving colors and recomputing visible shares', () => {
		const tree = buildTokenUsageTreemapTreeData([
			{ name: 'Alpha', amountUsd: 60, category: 'DeFi' },
			{ name: 'Beta', amountUsd: 40, category: 'DeFi' },
			{ name: 'Desk', amountUsd: 50, category: 'CEX' }
		])
		const options = getTokenUsageTreemapProtocolOptions(tree)
		expect(filterTokenUsageTreemapTreeData(tree, new Set(options.map((option) => option.key)))).toBe(tree)
		const filtered = filterTokenUsageTreemapTreeData(tree, new Set([options[1].key, options[2].key]))

		expect(options.map((option) => option.name)).toEqual(['Alpha', 'Beta', 'Desk'])
		expect(filtered.map((category) => [category.name, category.value])).toEqual([
			['DeFi', [40, 44.44, 44.44]],
			['CEX', [50, 55.56, 55.56]]
		])
		expect(filtered[0].children?.[0]).toMatchObject({
			name: 'Beta',
			value: [40, 100, 44.44],
			itemStyle: tree[0].children?.[1].itemStyle
		})
		expect(prepareTokenUsageTreemapCsv(filtered, 'usage')).toEqual({
			filename: 'usage',
			rows: [
				['Protocol', 'Category', 'Amount', 'Category Share (%)', 'Total Share (%)'],
				['Beta', 'DeFi', 40, 100, 44.44],
				['Desk', 'CEX', 50, 100, 55.56]
			]
		})
	})

	it('totals the visible protocols as CEX and protocol filters change', () => {
		const rows = [
			{ name: 'Alpha', amountUsd: 60, category: 'DeFi' },
			{ name: 'Beta', amountUsd: 40, category: 'DeFi' },
			{ name: 'Desk', amountUsd: 50, category: 'CEX' }
		]
		const allProtocols = buildTokenUsageTreemapTreeData(rows)
		const withoutCex = buildTokenUsageTreemapTreeData(rows.filter((row) => row.category !== 'CEX'))
		const options = getTokenUsageTreemapProtocolOptions(allProtocols)
		const oneProtocol = filterTokenUsageTreemapTreeData(allProtocols, new Set([options[0].key]))

		expect(getTokenUsageTreemapTotal(allProtocols)).toBe(150)
		expect(getTokenUsageTreemapTotal(withoutCex)).toBe(100)
		expect(getTokenUsageTreemapTotal(oneProtocol)).toBe(60)
		expect(getTokenUsageTreemapTotal([])).toBe(0)
	})

	it('uses composite keys and disambiguated labels for duplicate names in different categories', () => {
		const tree = buildTokenUsageTreemapTreeData([
			{ name: 'Shared', amountUsd: 60, category: 'DeFi' },
			{ name: 'Shared', amountUsd: 40, category: 'CEX' }
		])
		const options = getTokenUsageTreemapProtocolOptions(tree)

		expect(options).toEqual([
			{ key: '["DeFi","Shared"]', name: 'Shared (DeFi)' },
			{ key: '["CEX","Shared"]', name: 'Shared (CEX)' }
		])
		expect(filterTokenUsageTreemapTreeData(tree, new Set([options[1].key])).map((node) => node.name)).toEqual(['CEX'])
	})

	it('keeps slash-containing category and protocol tuples independently selectable', () => {
		const tree = buildTokenUsageTreemapTreeData([
			{ name: 'C', amountUsd: 60, category: 'A/B' },
			{ name: 'B/C', amountUsd: 40, category: 'A' }
		])
		const options = getTokenUsageTreemapProtocolOptions(tree)
		const selected = options.find((option) => option.key === '["A","B/C"]')

		expect(new Set(options.map((option) => option.key)).size).toBe(2)
		expect(selected).toBeDefined()
		if (!selected) throw new Error('Missing slash-containing protocol option')
		expect(filterTokenUsageTreemapTreeData(tree, new Set([selected.key]))).toHaveLength(1)
	})
})
