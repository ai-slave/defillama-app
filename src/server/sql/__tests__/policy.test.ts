import { describe, expect, test } from 'vitest'
import type { SqlQueryRecipe } from '~/containers/ProDashboard/types'
import { SqlPolicyError, validateSql, validateSqlRecipe } from '../policy'

describe('SQL execution policy', () => {
	test.each([
		'SELECT count(*) AS n FROM protocols',
		'SELECT name, sum(tvl) OVER (PARTITION BY category) FROM protocols;',
		"WITH revenue AS (SELECT name, total30d FROM fees) SELECT p.name, r.total30d FROM protocols p JOIN revenue r ON p.name = r.name WHERE p.category = 'Lending'",
		"SELECT 'updated_at', 1 AS created_at -- ordinary analytics",
		"SELECT concat_ws('; ', 'Low capture', 'High fees')"
	])('allows analytical SQL: %s', (sql) => {
		expect(() => validateSql(sql)).not.toThrow()
	})

	test.each([
		'CREATE TABLE x AS SELECT 1',
		'WITH x AS (SELECT 1) DELETE FROM protocols',
		'SELECT 1; DROP TABLE protocols',
		"SELECT * FROM read_csv_auto('/etc/passwd')",
		'SELECT * FROM "READ_BLOB"(\'/etc/passwd\')',
		"SELECT * FROM query('SEL' || 'ECT 1')",
		"SELECT * FROM query_table('protocols')",
		"SELECT * FROM histogram_values(chr(112)||'g'||chr(95)||'catalog.'||chr(112)||'g'||chr(95)||'settings', name)",
		'SELECT * FROM main."HiStOgRaM"(\'protocols\', name)',
		'SELECT * FROM truncate_duckdb_logs()',
		"SELECT 'histogram_values' AS label",
		'SELECT 1 /* histogram */',
		"SELECT * FROM json_execute_serialized_sql('{}')",
		"SELECT json_serialize_sql('SEL' || 'ECT 1')",
		'SELECT name FROM system.tables',
		'SELECT * FROM information_schema.tables',
		'SELECT * FROM duckdb_secrets()',
		"SELECT current_setting('enable_external_access')",
		'SELECT current_user()',
		'SET enable_external_access=true',
		'INSTALL httpfs',
		'SELECT 1 -- LOAD httpfs',
		'SELECT 1 /* CoPy */',
		"SELECT 'attach' AS label",
		'SELECT $$INSTALL$$ AS label',
		'SELECT 1 AS "drop"',
		'FROM protocols SELECT *',
		'EXPLAIN SELECT * FROM protocols'
	])('blocks prohibited SQL, even inside strings/comments: %s', (sql) => {
		expect(() => validateSql(sql)).toThrow(SqlPolicyError)
	})

	test('does not identify the blocked word in its error', () => {
		expect(() => validateSql('SELECT 1 -- INSTALL')).toThrow('Something went wrong')
	})

	test('rejects malformed persisted recipes rather than crashing the route', () => {
		for (const recipe of [null, { sql: 'SELECT 1' }, { sql: 'SELECT 1', tableSources: [null] }]) {
			expect(() => validateSqlRecipe(recipe as unknown as SqlQueryRecipe)).toThrow(SqlPolicyError)
		}
	})
})
