import { beforeEach, describe, expect, test, vi } from 'vitest'

const fetchCsvMock = vi.fn()

vi.mock('../tableLoader', () => ({
	fetchCsvForSource: (...args: Array<unknown>) => fetchCsvMock(...args)
}))

import { runServerSql, SqlRunTimeoutError } from '../runner'

const RECIPE_SOURCES = [{ kind: 'dataset', slug: 'test-protocols' } as const]

beforeEach(() => {
	fetchCsvMock.mockReset()
	fetchCsvMock.mockResolvedValue('name,tvl\r\nAave,100\r\nUniswap,200\r\nCurve,50')
})

describe('runServerSql', () => {
	test('executes sql over loaded csv tables', async () => {
		const result = await runServerSql({
			sql: 'SELECT name, tvl FROM test_protocols WHERE tvl > 60 ORDER BY tvl DESC',
			tableSources: [...RECIPE_SOURCES]
		})
		expect(result.columns.map((c) => c.name)).toEqual(['name', 'tvl'])
		expect(result.rows).toEqual([
			{ name: 'Uniswap', tvl: 200 },
			{ name: 'Aave', tvl: 100 }
		])
		expect(fetchCsvMock).toHaveBeenCalledWith({ kind: 'dataset', slug: 'test-protocols' })
	}, 30_000)

	test('supports aggregates and preserves duckdb types', async () => {
		const result = await runServerSql({
			sql: 'SELECT count(*) AS n, sum(tvl) AS total FROM test_protocols',
			tableSources: [...RECIPE_SOURCES]
		})
		expect(result.rows).toEqual([{ n: 3, total: 350 }])
	}, 30_000)

	test('rejects on sql errors with the engine message', async () => {
		await expect(
			runServerSql({ sql: 'SELECT nope FROM test_protocols', tableSources: [...RECIPE_SOURCES] })
		).rejects.toThrow(/nope/i)
	}, 30_000)

	test('rejects empty queries without spawning', async () => {
		await expect(runServerSql({ sql: '   ', tableSources: [] })).rejects.toThrow('Empty query.')
		expect(fetchCsvMock).not.toHaveBeenCalled()
	})

	test('blocks filesystem access from user sql', async () => {
		await expect(
			runServerSql({
				sql: "SELECT * FROM read_csv_auto('/etc/hosts')",
				tableSources: [...RECIPE_SOURCES]
			})
		).rejects.toThrow(/disabled|permission|external/i)
	}, 30_000)

	test('kills runs that exceed the timeout', async () => {
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
