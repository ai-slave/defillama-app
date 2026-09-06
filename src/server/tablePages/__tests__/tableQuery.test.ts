import { describe, expect, test } from 'vitest'
import {
	canonicalQuerySignature,
	defineTableQuery,
	enumField,
	nullableNumberField,
	shapeOrNullField,
	stringSetField,
	textField
} from '../tableQuery'

describe('canonicalQuerySignature', () => {
	test('signs identically across key order and excluded paging params', () => {
		const a = canonicalQuerySignature(
			{ chain: ['Base', 'Ethereum'], minApy: '5', page: '3', pageSize: '50' },
			{ exclude: ['page', 'pageSize'] }
		)
		const b = canonicalQuerySignature(
			{ pageSize: '100', minApy: '5', page: '1', chain: ['Base', 'Ethereum'] },
			{ exclude: ['page', 'pageSize'] }
		)
		expect(a).toBe(b)
	})

	test('keeps repeated-value order significant - parsers may read only the first value', () => {
		const tvlFirst = canonicalQuerySignature({ sortBy: ['tvl', 'apy'] }, { exclude: [] })
		const apyFirst = canonicalQuerySignature({ sortBy: ['apy', 'tvl'] }, { exclude: [] })
		expect(tvlFirst).not.toBe(apyFirst)
	})

	test('distinguishes real filter differences; absent params drop but empty strings sign', () => {
		const base = canonicalQuerySignature({ minApy: '5' }, { exclude: [] })
		expect(canonicalQuerySignature({ minApy: '7' }, { exclude: [] })).not.toBe(base)
		expect(canonicalQuerySignature({ minApy: '5', chain: undefined }, { exclude: [] })).toBe(base)
		// An empty string may parse differently from an absent param, so it must
		// not alias to the same prepared-rows entry.
		expect(canonicalQuerySignature({ minApy: '5', chain: '' }, { exclude: [] })).not.toBe(base)
	})
})

// Modeled on the ProtocolRankings query so K2's field list is provably
// expressible with zero custom parsing code.
const SORT_KEYS = ['tvl', 'fees_30d', 'custom'] as const
type Query = {
	search: string
	minTvl: number | null
	sort: (typeof SORT_KEYS)[number]
	order: 'asc' | 'desc'
	customSort: { formula: string; formatType: string } | null
	tvlKeys: Array<string>
}

const schema = defineTableQuery<Query>({
	fields: {
		search: textField({ maxLength: 200, signatureValue: (value) => value.trim().toLowerCase() }),
		minTvl: nullableNumberField(),
		sort: enumField(SORT_KEYS, { nonStringFallback: 'tvl' }),
		order: enumField(['asc', 'desc'] as const, { fallback: 'desc' }),
		customSort: shapeOrNullField({
			formula: textField({ maxLength: 500 }),
			formatType: textField({ maxLength: 20, fallback: 'auto' })
		}),
		tvlKeys: {
			...stringSetField({ allow: (value) => ['staking', 'pool2'].includes(value) }),
			signatureValue: (value) => [...value].sort()
		}
	},
	refine: (query) => {
		if (query.sort !== 'custom') return { ...query, customSort: null }
		return query.customSort?.formula ? query : null
	}
})

const DEFAULTS: Query = { search: '', minTvl: null, sort: 'tvl', order: 'desc', customSort: null, tvlKeys: [] }

describe('defineTableQuery', () => {
	test('coerces missing fields to declared defaults and keeps valid values', () => {
		expect(schema.normalize({})).toEqual(DEFAULTS)
		expect(
			schema.normalize({
				search: 'Uni',
				minTvl: 100,
				sort: 'custom',
				customSort: { formula: 'fees_30d / tvl', formatType: 'number' },
				tvlKeys: ['staking', 'not-a-key', 'pool2', 'staking']
			})
		).toEqual({
			search: 'Uni',
			minTvl: 100,
			sort: 'custom',
			order: 'desc',
			customSort: { formula: 'fees_30d / tvl', formatType: 'number' },
			tvlKeys: ['pool2', 'staking']
		})
	})

	test('rejects malformed values and unsatisfied cross-field rules', () => {
		expect(schema.normalize({ minTvl: '100' })).toBeNull()
		expect(schema.normalize({ sort: 'unknown' })).toBeNull()
		expect(schema.normalize({ sort: 'custom' })).toBeNull()
		expect(schema.normalize({ sort: 'custom', customSort: { formula: '' } })).toBeNull()
	})

	test('drops customSort when the sort is not custom', () => {
		expect(schema.normalize({ sort: 'tvl', customSort: { formula: 'x', formatType: 'number' } })).toEqual(DEFAULTS)
	})

	test('signs caller-built queries through refine, matching their normalized form', () => {
		// A hand-built query that violates the cross-field rule (customSort set
		// while sort is not custom) must sign identically to the normalized query.
		const raw = { ...DEFAULTS, customSort: { formula: 'x', formatType: 'number' } } as Query
		expect(schema.signature(raw)).toBe(schema.signature(DEFAULTS))
		expect(schema.signature({ ...DEFAULTS, tvlKeys: ['staking', 'pool2'] })).toBe(
			schema.signature({ ...DEFAULTS, tvlKeys: ['pool2', 'staking'] })
		)
	})

	test('signature ignores undeclared keys and canonicalizes declared ones', () => {
		const withUiState = { ...DEFAULTS, metric: 'Fees', period: '7d' } as Query
		expect(schema.signature(withUiState)).toBe(schema.signature(DEFAULTS))
		expect(schema.signature({ ...DEFAULTS, search: '  UNI ' })).toBe(schema.signature({ ...DEFAULTS, search: 'uni' }))
		expect(schema.signature({ ...DEFAULTS, minTvl: 5 })).not.toBe(schema.signature(DEFAULTS))
	})

	test('is stable across field declaration order, not input order', () => {
		const a = schema.normalize({ minTvl: 1, search: 'a' })
		const b = schema.normalize({ search: 'a', minTvl: 1 })
		expect(a && schema.signature(a)).toBe(b && schema.signature(b))
	})
})
