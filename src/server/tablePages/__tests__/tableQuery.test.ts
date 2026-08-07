import { describe, expect, it } from 'vitest'
import {
	defineTableQuery,
	enumField,
	nullableNumberField,
	shapeOrNullField,
	stringSetField,
	textField
} from '../tableQuery'

// Modeled on the ProtocolRankings query so K2's field list is provably
// expressible with zero custom parsing code.
const SORT_KEYS = ['tvl', 'fees_30d', 'custom'] as const
type Query = {
	search: string
	minTvl: number | null
	sort: (typeof SORT_KEYS)[number]
	order: 'asc' | 'desc'
	customSort: { formula: string; formatType: string } | null
	tvlKeys: string[]
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
	it('coerces missing fields to declared defaults and keeps valid values', () => {
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

	it('rejects malformed values and unsatisfied cross-field rules', () => {
		expect(schema.normalize({ minTvl: '100' })).toBeNull()
		expect(schema.normalize({ sort: 'unknown' })).toBeNull()
		expect(schema.normalize({ sort: 'custom' })).toBeNull()
		expect(schema.normalize({ sort: 'custom', customSort: { formula: '' } })).toBeNull()
	})

	it('drops customSort when the sort is not custom', () => {
		expect(schema.normalize({ sort: 'tvl', customSort: { formula: 'x', formatType: 'number' } })).toEqual(DEFAULTS)
	})

	it('signs caller-built queries through refine, matching their normalized form', () => {
		// A hand-built query that violates the cross-field rule (customSort set
		// while sort is not custom) must sign identically to the normalized query.
		const raw = { ...DEFAULTS, customSort: { formula: 'x', formatType: 'number' } } as Query
		expect(schema.signature(raw)).toBe(schema.signature(DEFAULTS))
		expect(schema.signature({ ...DEFAULTS, tvlKeys: ['staking', 'pool2'] })).toBe(
			schema.signature({ ...DEFAULTS, tvlKeys: ['pool2', 'staking'] })
		)
	})

	it('signature ignores undeclared keys and canonicalizes declared ones', () => {
		const withUiState = { ...DEFAULTS, metric: 'Fees', period: '7d' } as Query
		expect(schema.signature(withUiState)).toBe(schema.signature(DEFAULTS))
		expect(schema.signature({ ...DEFAULTS, search: '  UNI ' })).toBe(schema.signature({ ...DEFAULTS, search: 'uni' }))
		expect(schema.signature({ ...DEFAULTS, minTvl: 5 })).not.toBe(schema.signature(DEFAULTS))
	})

	it('is stable across field declaration order, not input order', () => {
		const a = schema.normalize({ minTvl: 1, search: 'a' })
		const b = schema.normalize({ search: 'a', minTvl: 1 })
		expect(a && schema.signature(a)).toBe(b && schema.signature(b))
	})
})
