import { beforeEach, describe, expect, test } from 'vitest'
import { V2_SERVER_URL } from '~/constants'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { SqlPolicyError } from '../policy'
import { runServerSql, SqlRunTimeoutError } from '../runner'
import { clearCsvCacheForTests } from '../tableLoader'

const http = installFixtureFetch()

const RECIPE_SOURCES = [{ kind: 'dataset', slug: 'chains' } as const]
// Tests that reach the engine spawn a real DuckDB worker; its cold start on a loaded machine can pass the
// default timeout, so those tests set 30s. Runs normally finish in well under a second.

beforeEach(() => {
	clearCsvCacheForTests()
	http.serve({
		[`${V2_SERVER_URL}/chains`]: [
			{ name: 'Aave', tvl: 100 },
			{ name: 'Uniswap', tvl: 200 },
			{ name: 'Curve', tvl: 50 }
		]
	})
})

describe('runServerSql', () => {
	test.each(['histogram', 'histogram_values'])(
		'blocks the encoded-source %s macro before loading tables',
		async (macro) => {
			await expect(
				runServerSql({
					sql: `SELECT * FROM ${macro}(chr(112)||'g'||chr(95)||'catalog.'||chr(112)||'g'||chr(95)||'settings', name || chr(61) || setting)`,
					tableSources: [...RECIPE_SOURCES]
				})
			).rejects.toThrow('Something went wrong')
			expect(http.requests).toEqual([])
		}
	)

	test('rejects multiple SELECT statements through the engine parser', async () => {
		await expect(runServerSql({ sql: 'SELECT 1; SELECT 2', tableSources: [] })).rejects.toThrow(SqlPolicyError)
	}, 30_000)

	test('executes sql over loaded csv tables', async () => {
		const result = await runServerSql({
			sql: 'SELECT name, tvl FROM chains WHERE tvl > 60 ORDER BY tvl DESC',
			tableSources: [...RECIPE_SOURCES]
		})
		expect(result.columns.map((c) => c.name)).toEqual(['name', 'tvl'])
		expect(result.rows).toEqual([
			{ name: 'Uniswap', tvl: 200 },
			{ name: 'Aave', tvl: 100 }
		])
	}, 30_000)

	test('supports aggregates and preserves duckdb types', async () => {
		const result = await runServerSql({
			sql: 'SELECT count(*) AS n, sum(tvl) AS total FROM chains',
			tableSources: [...RECIPE_SOURCES]
		})
		expect(result.rows).toEqual([{ n: 3, total: 350 }])
	}, 30_000)

	test('rejects on sql errors with the engine message', async () => {
		await expect(runServerSql({ sql: 'SELECT nope FROM chains', tableSources: [...RECIPE_SOURCES] })).rejects.toThrow(
			/nope/i
		)
	}, 30_000)

	test('rejects empty queries', async () => {
		await expect(runServerSql({ sql: '   ', tableSources: [] })).rejects.toThrow('Empty query.')
	})

	test('blocks filesystem access from user sql', async () => {
		await expect(
			runServerSql({
				sql: "SELECT * FROM read_csv_auto('/etc/hosts')",
				tableSources: [...RECIPE_SOURCES]
			})
		).rejects.toThrow(SqlPolicyError)
		expect(http.requests).toEqual([])
	}, 30_000)

	test('rejects administrative SQL before fetching data', async () => {
		await expect(
			runServerSql({ sql: 'SELECT 1; CREATE TABLE x AS SELECT 2', tableSources: [...RECIPE_SOURCES] })
		).rejects.toThrow(SqlPolicyError)
		expect(http.requests).toEqual([])
	})

	test('still denies filesystem shorthand at the engine boundary', async () => {
		await expect(
			runServerSql({ sql: "SELECT * FROM '/tmp/sql-policy-fixture.csv'", tableSources: [] })
		).rejects.toThrow(/disabled|permission|external/i)
	}, 30_000)

	test('executes WITH queries through the SELECT-only prepared statement', async () => {
		const result = await runServerSql({
			sql: 'WITH x AS (SELECT tvl FROM chains) SELECT sum(tvl) AS total FROM x',
			tableSources: [...RECIPE_SOURCES]
		})
		expect(result.rows).toEqual([{ total: 350 }])
	}, 30_000)

	test('rejects runs that exceed the timeout', async () => {
		await expect(
			runServerSql(
				{
					sql: 'SELECT max(a.range * b.range) FROM range(100000) a, range(1000000) b',
					tableSources: [...RECIPE_SOURCES]
				},
				{ timeoutMs: 300 }
			)
		).rejects.toThrow(SqlRunTimeoutError)
	}, 30_000)
})
