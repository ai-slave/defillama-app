import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'
import { tableFromArrays, type Table } from 'apache-arrow'
import { afterEach, expect, test, vi } from 'vitest'
import { queryDuckDB } from '../duckdb/query'
import { runSql, type ExecutorCtx } from '../executor'

afterEach(() => vi.useRealTimers())

function reader(table: Table) {
	return { schema: table.schema, readAll: async () => table.batches }
}
function setup() {
	const send = vi.fn()
	const cancelSent = vi.fn().mockResolvedValue(true)
	const context: ExecutorCtx = {
		conn: { send, cancelSent } as unknown as AsyncDuckDBConnection,
		loadedTables: [],
		loadSource: vi.fn(),
		chartOptionsMap: {}
	}
	return { context, send, cancelSent }
}

test('cancellable execution collects every Arrow batch and preserves empty-result columns', async () => {
	const { context, send } = setup()
	const table = tableFromArrays({ value: new Int32Array([1]), label: ['one'] }).concat(
		tableFromArrays({ value: new Int32Array([2]), label: ['two'] })
	)
	send.mockResolvedValueOnce(reader(table)).mockResolvedValueOnce(reader(table.slice(0, 0)))
	expect(await runSql(context, 'SELECT value, label', {}, undefined, new AbortController().signal)).toMatchObject({
		ok: true,
		result: {
			columns: [{ name: 'value' }, { name: 'label' }],
			rows: [
				[1, 'one'],
				[2, 'two']
			]
		}
	})
	expect(
		await runSql(context, 'SELECT value, label WHERE false', {}, undefined, new AbortController().signal)
	).toMatchObject({
		ok: true,
		result: { columns: [{ name: 'value' }, { name: 'label' }], rows: [] }
	})
})

test('abort waits for the driver to finish cancellation before another query can reuse the connection', async () => {
	const { context, send, cancelSent } = setup()
	const pending = Promise.withResolvers<ReturnType<typeof reader>>()
	send
		.mockReturnValueOnce(pending.promise)
		.mockResolvedValueOnce(reader(tableFromArrays({ value: new Int32Array([3]) })))
	const controller = new AbortController()
	const result = runSql(context, 'SELECT 1 AS value', {}, undefined, controller.signal)
	let settled = false
	void result.then(() => {
		settled = true
	})
	await Promise.resolve()
	controller.abort()
	await Promise.resolve()
	expect(cancelSent).toHaveBeenCalledOnce()
	expect(settled).toBe(false)
	pending.reject(new Error('Query canceled'))
	expect(await result).toMatchObject({ ok: false, canceled: true })
	expect(await runSql(context, 'SELECT 3 AS value', {}, undefined, new AbortController().signal)).toMatchObject({
		ok: true,
		result: { rows: [[3]] }
	})
})

test('an abort during the fresh-load retry delay never starts another query', async () => {
	vi.useFakeTimers()
	const { context, send } = setup()
	context.loadSource = async (source) => ({ name: 'protocols', source, columns: [], rowCount: 0, loadedAt: 0 })
	send.mockRejectedValue(new Error('function signature mismatch'))
	const controller = new AbortController()
	const result = runSql(context, 'SELECT * FROM protocols', {}, undefined, controller.signal)
	await vi.advanceTimersByTimeAsync(0)
	expect(send).toHaveBeenCalledOnce()
	controller.abort()
	await vi.advanceTimersByTimeAsync(60)
	expect(await result).toMatchObject({ ok: false, canceled: true })
	expect(send).toHaveBeenCalledOnce()
})

test('a fresh-load signature failure retries once and keeps the successful result', async () => {
	vi.useFakeTimers()
	const { context, send } = setup()
	const loadSource = vi.fn(async (source) => ({ name: 'protocols', source, columns: [], rowCount: 0, loadedAt: 0 }))
	context.loadSource = loadSource
	send
		.mockRejectedValueOnce(new Error('function signature mismatch'))
		.mockResolvedValueOnce(reader(tableFromArrays({ value: new Int32Array([4]) })))
	const result = runSql(context, 'SELECT * FROM protocols', {}, undefined, new AbortController().signal)
	await vi.advanceTimersByTimeAsync(60)
	expect(await result).toMatchObject({ ok: true, result: { rows: [[4]] } })
	expect(send).toHaveBeenCalledTimes(2)
	expect(loadSource).toHaveBeenCalledOnce()
})

test.each([
	['an ordinary failure after a fresh load', 'SELECT missing FROM protocols', 'Column does not exist'],
	['a signature mismatch without a fresh load', 'SELECT 1', 'function signature mismatch']
])('%s stays visible without retrying', async (_case, sql, message) => {
	const { context, send } = setup()
	context.loadSource = async (source) => ({ name: 'protocols', source, columns: [], rowCount: 0, loadedAt: 0 })
	send.mockRejectedValue(new Error(message))
	expect(await runSql(context, sql, {}, undefined, new AbortController().signal)).toMatchObject({
		ok: false,
		error: message
	})
	expect(send).toHaveBeenCalledOnce()
})

test('queued cancellation cannot interrupt another result, and schema operations wait for its batches', async () => {
	const { context, send, cancelSent } = setup()
	const table = tableFromArrays({ value: new Int32Array([8]) })
	const batches = Promise.withResolvers<typeof table.batches>()
	send.mockResolvedValueOnce({ schema: table.schema, readAll: () => batches.promise })
	const query = vi.fn().mockResolvedValue(table)
	context.conn!.query = query
	const first = runSql(context, 'SELECT 8 AS value', {}, undefined, new AbortController().signal)
	const canceled = new AbortController()
	const second = runSql(context, 'SELECT 9 AS value', {}, undefined, canceled.signal)
	const schema = queryDuckDB(context.conn!, 'DESCRIBE protocols')
	await Promise.resolve()
	canceled.abort()
	expect(cancelSent).not.toHaveBeenCalled()
	expect(query).not.toHaveBeenCalled()
	batches.resolve(table.batches)
	expect(await first).toMatchObject({ ok: true, result: { rows: [[8]] } })
	expect(await second).toMatchObject({ ok: false, canceled: true })
	await schema
	expect(send).toHaveBeenCalledOnce()
	expect(query).toHaveBeenCalledWith('DESCRIBE protocols')
})
