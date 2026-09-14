import { describe, expect, test } from 'vitest'
import { TableCursorError } from '~/server/tablePages/cursorPage.server'
import { buildProtocolListCsv } from '../export.server'
import { getProtocolListRows, paginateProtocolListRows } from '../pagination.server'
import { protocolListSignature, protocolListUrl } from '../tableQuery'
import type { IRecentProtocol, IRecentProtocolsPageData } from '../types'

const entry = (tvl: number | null) => ({ tvl, tvlPrevDay: tvl, tvlPrevWeek: tvl, tvlPrevMonth: tvl })
function row(name: string, listedAt: number, tvl: number | null): IRecentProtocol {
	return {
		name,
		defillamaId: name,
		listedAt,
		symbol: '-',
		logo: null,
		url: '',
		category: 'Lending',
		chains: ['Ethereum'],
		chainTvls: { Ethereum: entry(tvl) },
		...entry(tvl),
		mcap: null,
		extraTvl: {}
	}
}
function data(protocols: Array<IRecentProtocol>): IRecentProtocolsPageData {
	return { protocols, chainList: ['Ethereum', 'Base'], categories: ['Lending', 'Dexs'], forkedList: { Fork: true } }
}
const names = (rows: Array<{ name: string }>) => rows.map((protocol) => protocol.name)

describe('server protocol lists', () => {
	test('orders newest first with stable ties and exact page boundaries', () => {
		const rows = getProtocolListRows(
			data([row('Old', 1, 10), row('B', 3, 20), row('A', 3, 30), row('Middle', 2, 40)]),
			{}
		)
		const first = paginateProtocolListRows(rows, 'version', {}, null, 2)
		const second = paginateProtocolListRows(rows, 'version', {}, first.nextCursor, 2)
		expect(names(first.rows)).toEqual(['A', 'B'])
		expect(names(second.rows)).toEqual(['Middle', 'Old'])
		expect([first.total, first.hasMore, second.total, second.hasMore, second.nextCursor]).toEqual([
			4,
			true,
			4,
			false,
			null
		])
		expect(() => paginateProtocolListRows(rows, 'changed', {}, first.nextCursor, 2)).toThrow(TableCursorError)
		expect(() => paginateProtocolListRows(rows, 'version', { hideForks: 'true' }, first.nextCursor, 2)).toThrow(
			TableCursorError
		)
	})
	test('filters the full eligible population before pagination and exports every match', () => {
		const source = data([
			row('Excluded', 9, 100),
			row('Match A', 1, 10),
			row('Match B', 2, 20),
			row('Match C', 3, 30),
			row('Fork', 4, 20)
		])
		const query = { search: 'match', minTvl: '15', sort: 'tvl', order: 'asc', hideForks: 'true' }
		const rows = getProtocolListRows(source, query)
		const first = paginateProtocolListRows(rows, 'v', query, null, 1)
		expect(names(first.rows)).toEqual(['Match B'])
		expect(first.total).toBe(2)
		expect(buildProtocolListCsv(rows, 'recent')).toBe(
			'Name,Category,TVL,Listed At,1d TVL Change,7d TVL Change,1m TVL Change\nMatch B,Lending,20,2,0,0,0\nMatch C,Lending,30,3,0,0,0'
		)
	})
	test('applies chain exclusions, additive TVL, category and fork rules before bounds', () => {
		const dual = {
			...row('Dual', 1, 110),
			chains: ['Ethereum', 'Base'],
			chainTvls: { Ethereum: entry(10), Base: entry(100), 'Ethereum-staking': entry(5), 'Base-staking': entry(50) }
		}
		const source = data([dual, row('Fork', 2, 20), { ...row('Dex', 3, 25), category: 'Dexs' }])
		expect(
			getProtocolListRows(source, {
				excludeChain: 'Base',
				excludeCategory: 'Dexs',
				hideForks: 'true',
				tvlKeys: ['staking', 'doublecounted'],
				minTvl: '15',
				maxTvl: '15'
			}).map((r) => [r.name, r.tvl])
		).toEqual([['Dual', 15]])
		expect(names(getProtocolListRows(source, { chain: 'Base' }))).toEqual(['Dual'])
		expect(names(getProtocolListRows(source, { category: 'Dexs' }))).toEqual(['Dex'])
		expect(names(getProtocolListRows(source, { category: '' }))).toEqual([])
		expect(names(getProtocolListRows(source, { category: 'All' }))).toEqual([])
		expect(names(getProtocolListRows(source, { category: 'None' }))).toEqual([])
		expect(names(getProtocolListRows(source, { chain: 'None' }))).toEqual([])
		expect(names(getProtocolListRows(source, { hideForks: 'true' }))).toEqual(['Dex', 'Dual'])
	})
	test('keeps unavailable measurements last in either order and preserves zero bounds', () => {
		const source = data([
			row('Unknown', 1, null),
			row('Zero', 2, 0),
			row('Known', 3, 10),
			{ ...row('Missing', 4, 100), chainTvls: {} }
		])
		expect(names(getProtocolListRows(source, { sort: 'tvl', order: 'asc' }))).toEqual([
			'Zero',
			'Known',
			'Missing',
			'Unknown'
		])
		expect(names(getProtocolListRows(source, { sort: 'tvl' }))).toEqual(['Known', 'Zero', 'Missing', 'Unknown'])
		expect(names(getProtocolListRows(source, { maxTvl: '0' }))).toEqual(['Zero'])
		expect(names(getProtocolListRows(source, { minTvl: '10' }))).toEqual(['Known'])
	})
	test('sorts and exports funding subtotals and undisclosed counts without losing nulls', () => {
		const source = data([
			{ ...row('Unknown', 1, 10), raiseSummary: { totalUsd: null, undisclosedCount: 2 } },
			{ ...row('Zero', 2, 20), raiseSummary: { totalUsd: 0, undisclosedCount: 0 } },
			{ ...row('Partial', 3, 30), raiseSummary: { totalUsd: 100, undisclosedCount: 1 } }
		])
		const rows = getProtocolListRows(source, { sort: 'totalRaised' })
		expect(names(rows)).toEqual(['Partial', 'Zero', 'Unknown'])
		expect(buildProtocolListCsv(rows, 'airdrops')).toBe(
			'Name,Category,TVL,Disclosed Money Raised,Undisclosed Funding Rounds,Listed At,1d TVL Change,7d TVL Change,1m TVL Change\nPartial,Lending,30,100,1,3,0,0,0\nZero,Lending,20,0,0,2,0,0,0\nUnknown,Lending,10,,2,1,0,0,0'
		)
	})
	test('keeps query identity through URL transport, including explicit empty categories', () => {
		const query = { chain: ['Ethereum', 'Base'], category: '', tvlKeys: ['staking'], sort: 'listedAt', order: 'desc' }
		const url = new URL(protocolListUrl('recent', query, 'snapshot', 'cursor'), 'http://localhost')
		expect(url.searchParams.getAll('chain')).toEqual(['Ethereum', 'Base'])
		expect(url.searchParams.get('category')).toBe('')
		expect(url.searchParams.get('snapshot')).toBe('snapshot')
		expect(protocolListSignature(query)).toBe(
			protocolListSignature({ chain: ['Ethereum', 'Base'], category: '', tvlKeys: 'staking' })
		)
		expect(protocolListSignature({ category: '' })).not.toBe(protocolListSignature({}))
	})
})
