import { describe, expect, it } from 'vitest'
import type { SqlQueryRecipe } from '~/containers/ProDashboard/types'
import { hashSqlQuery } from '../queryHash'

describe('hashSqlQuery', () => {
	it('is stable across source order and display-only fields', () => {
		const a = hashSqlQuery({
			sql: 'SELECT 1',
			tableSources: [
				{ kind: 'chart', slug: 'tvl', param: 'aave', paramLabel: 'Aave' },
				{ kind: 'dataset', slug: 'protocols' }
			]
		})
		const b = hashSqlQuery({
			sql: '  SELECT 1  ',
			tableSources: [
				{ kind: 'dataset', slug: 'protocols' },
				{ kind: 'chart', slug: 'tvl', param: 'aave' }
			]
		})
		expect(a).toBe(b)
		expect(a).toMatch(/^[a-f0-9]{64}$/)
	})

	it('changes when sql or sources change', () => {
		const base = hashSqlQuery({ sql: 'SELECT 1', tableSources: [{ kind: 'dataset', slug: 'protocols' }] })
		expect(hashSqlQuery({ sql: 'SELECT 2', tableSources: [{ kind: 'dataset', slug: 'protocols' }] })).not.toBe(base)
		expect(hashSqlQuery({ sql: 'SELECT 1', tableSources: [{ kind: 'dataset', slug: 'yields' }] })).not.toBe(base)
		expect(
			hashSqlQuery({ sql: 'SELECT 1', tableSources: [{ kind: 'chart', slug: 'protocols', param: 'x' }] })
		).not.toBe(base)
	})

	it('separates execution snapshots with different row caps', () => {
		const query: SqlQueryRecipe = { sql: 'SELECT 1', tableSources: [{ kind: 'dataset', slug: 'protocols' }] }
		expect(hashSqlQuery(query, { rowCap: 100 })).not.toBe(hashSqlQuery(query, { rowCap: 500 }))
		expect(hashSqlQuery(query)).toBe(hashSqlQuery(query, {}))
	})
})
