export const SQL_WORKER_SCRIPT = `
'use strict'

let raw = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => {
	raw += chunk
})
process.stdin.on('end', () => {
	run(raw)
})

function reply(payload) {
	process.stdout.write(JSON.stringify(payload), () => {
		process.exit(0)
	})
}

class SqlPolicyError extends Error {}

function toJsonSafe(value) {
	if (typeof value === 'bigint') {
		return value <= Number.MAX_SAFE_INTEGER && value >= Number.MIN_SAFE_INTEGER ? Number(value) : value.toString()
	}
	if (value === null || value === undefined) return null
	if (value instanceof Date) return value.toISOString()
	if (Array.isArray(value)) return value.map(toJsonSafe)
	if (typeof value === 'object') {
		if (value.constructor !== Object && typeof value.toString === 'function') return value.toString()
		const out = {}
		for (const key of Object.keys(value)) out[key] = toJsonSafe(value[key])
		return out
	}
	return value
}

async function run(input) {
	try {
		const job = JSON.parse(input)
		const { DuckDBInstance, StatementType } = require('@duckdb/node-api')
		const instance = await DuckDBInstance.create(':memory:')
		const conn = await instance.connect()

		await conn.run("SET memory_limit='" + job.memoryLimit + "'")
		await conn.run('SET threads=' + Number(job.threads))

		for (const table of job.tables) {
			const path = String(table.csvPath).replace(/'/g, "''")
			await conn.run(
				'CREATE OR REPLACE TABLE "' +
					table.name +
					'" AS SELECT * FROM read_csv_auto(\\'' +
					path +
					'\\', header = true, sample_size = -1)'
			)
		}

		await conn.run('SET autoinstall_known_extensions=false')
		await conn.run('SET autoload_known_extensions=false')
		await conn.run('SET enable_external_access=false')
		await conn.run('SET lock_configuration=true')

		const statements = await conn.extractStatements(job.sql)
		if (statements.count !== 1) throw new SqlPolicyError('Only a single SELECT query is allowed.')
		const prepared = await statements.prepare(0)
		if (prepared.statementType !== StatementType.SELECT) {
			throw new SqlPolicyError('Only a SELECT query is allowed.')
		}
		const reader = await prepared.runAndReadAll()
		const types = reader.columnTypes()
		const columns = reader.columnNames().map((name, i) => ({ name, type: String(types[i]) }))
		const rows = reader.getRowObjects().map((row) => {
			const out = {}
			for (const key of Object.keys(row)) out[key] = toJsonSafe(row[key])
			return out
		})

		reply({ ok: true, columns, rows })
	} catch (err) {
		reply({ ok: false, error: err instanceof Error ? err.message : String(err), policyViolation: err instanceof SqlPolicyError })
	}
}
`
