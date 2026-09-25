import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { SQL_WORKER_SCRIPT } from '../workerScript'

function runWorker(sql: string) {
	const result = spawnSync(process.execPath, ['-e', SQL_WORKER_SCRIPT], {
		input: JSON.stringify({ sql, tables: [], memoryLimit: '512MB', threads: 2 }),
		encoding: 'utf8',
		timeout: 10_000
	})
	expect(result.status).toBe(0)
	return JSON.parse(result.stdout) as { ok: boolean; error?: string }
}

describe('SQL worker isolation without the application keyword filter', () => {
	test('runs a single SELECT', () => {
		expect(runWorker('SELECT 1 AS n')).toMatchObject({ ok: true, rows: [{ n: 1 }] })
	})

	test.each([
		['SELECT 1; SELECT 2', 'Only a single SELECT query is allowed.'],
		['CREATE TABLE x AS SELECT 1', 'Only a SELECT query is allowed.'],
		['SET threads=1', 'Only a SELECT query is allowed.']
	])('rejects non-SELECT or multiple statements: %s', (sql, error) => {
		expect(runWorker(sql)).toEqual({ ok: false, error, policyViolation: true })
	})

	test('denies reading an existing file or unlocking external access', () => {
		const dir = mkdtempSync(join(tmpdir(), 'sql-worker-test-'))
		try {
			const path = join(dir, 'fixture.csv')
			writeFileSync(path, 'n\n1\n')
			const result = runWorker(`SELECT * FROM read_csv_auto('${path.replace(/'/g, "''")}')`)
			expect(result).toMatchObject({ ok: false })
			expect(result.error).toMatch(/disabled|permission|external/i)
			expect(runWorker('SET enable_external_access=true').ok).toBe(false)
		} finally {
			rmSync(dir, { recursive: true, force: true })
		}
	})
})
