import { describe, expect, test } from 'vitest'
import { parseQuickAddQuery } from '../quickAddQuery'

describe('quick add query parsing', () => {
	test('reads entity and metric in either order', () => {
		expect(parseQuickAddQuery('uniswap fees')).toMatchObject({
			entityTerms: ['uniswap'],
			entityGroups: [['uniswap']],
			metric: 'fees',
			command: null
		})
		expect(parseQuickAddQuery('fees uniswap')).toMatchObject({ entityTerms: ['uniswap'], metric: 'fees' })
	})

	test('splits comparisons into entity groups', () => {
		expect(parseQuickAddQuery('aave vs compound revenue')).toMatchObject({
			entityGroups: [['aave'], ['compound']],
			entityTerms: ['aave', 'compound'],
			metric: 'revenue'
		})
		expect(parseQuickAddQuery('uniswap, curve tvl').entityGroups).toEqual([['uniswap'], ['curve']])
		expect(parseQuickAddQuery('ethereum and solana').entityGroups).toEqual([['ethereum'], ['solana']])
	})

	test('reads the requested card form', () => {
		expect(parseQuickAddQuery('eth tvl metric')).toMatchObject({
			entityTerms: ['eth'],
			metric: 'tvl',
			form: 'metric'
		})
		expect(parseQuickAddQuery('uniswap fees chart').form).toBe('chart')
		expect(parseQuickAddQuery('solana tvl kpi').form).toBe('metric')
	})

	test('reads grouping and cumulative modifiers', () => {
		expect(parseQuickAddQuery('hyperliquid weekly volume')).toMatchObject({
			entityTerms: ['hyperliquid'],
			metric: 'volume',
			grouping: 'week'
		})
		expect(parseQuickAddQuery('uniswap monthly fees').grouping).toBe('month')
		expect(parseQuickAddQuery('cumulative fees uniswap')).toMatchObject({ cumulative: true, metric: 'fees' })
	})

	test('matches multi word metric synonyms before single words', () => {
		expect(parseQuickAddQuery('market cap of solana')).toMatchObject({
			metric: 'tokenMcap',
			entityTerms: ['solana']
		})
		expect(parseQuickAddQuery('hyperliquid open interest').metric).toBe('openInterest')
		expect(parseQuickAddQuery('base new users').metric).toBe('newUsers')
		expect(parseQuickAddQuery('base users').metric).toBe('activeUsers')
		expect(parseQuickAddQuery('arbitrum dex volume').metric).toBe('volume')
	})

	test('strips ticker prefixes and stop words', () => {
		expect(parseQuickAddQuery('$UNI price')).toMatchObject({ entityTerms: ['uni'], metric: 'tokenPrice' })
		expect(parseQuickAddQuery('add a chart of tvl for aave')).toMatchObject({
			entityTerms: ['aave'],
			metric: 'tvl',
			form: 'chart'
		})
	})

	test('recognizes entity free commands', () => {
		expect(parseQuickAddQuery('text')).toMatchObject({ command: 'text', entityTerms: [] })
		expect(parseQuickAddQuery('note').command).toBe('text')
		expect(parseQuickAddQuery('section').command).toBe('section')
		expect(parseQuickAddQuery('heading').command).toBe('section')
		expect(parseQuickAddQuery('table').command).toBe('table')
		expect(parseQuickAddQuery('top protocols').command).toBe('table')
		expect(parseQuickAddQuery('top protocols table')).toMatchObject({ command: 'table', entityTerms: [] })
	})

	test('drops entity type nouns so the entity and metric still resolve', () => {
		expect(parseQuickAddQuery('base chain tvl')).toMatchObject({ entityTerms: ['base'], metric: 'tvl' })
		expect(parseQuickAddQuery('uniswap protocol fees')).toMatchObject({ entityTerms: ['uniswap'], metric: 'fees' })
		expect(parseQuickAddQuery('solana network users')).toMatchObject({
			entityTerms: ['solana'],
			metric: 'activeUsers'
		})
		expect(parseQuickAddQuery('ethereum chains revenue')).toMatchObject({
			entityTerms: ['ethereum'],
			metric: 'revenue'
		})
	})

	test('detects the table commands before the entity type nouns are stripped', () => {
		expect(parseQuickAddQuery('top protocols').command).toBe('table')
		expect(parseQuickAddQuery('protocols table').command).toBe('table')
		expect(parseQuickAddQuery('protocol table').command).toBe('table')
	})

	test('keeps commands off queries that name an entity or a metric', () => {
		expect(parseQuickAddQuery('uniswap table').command).toBe(null)
		expect(parseQuickAddQuery('uniswap table').form).toBe('table')
		expect(parseQuickAddQuery('fees table').command).toBe(null)
	})

	test('returns an empty query for blank input', () => {
		expect(parseQuickAddQuery('   ')).toEqual({
			entityTerms: [],
			entityGroups: [],
			metric: null,
			form: null,
			grouping: null,
			cumulative: false,
			command: null
		})
	})
})
