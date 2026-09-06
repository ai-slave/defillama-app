import { describe, expect, test, vi } from 'vitest'
import { hashTableQuerySignature, prepareTableRows } from '../preparedRows.server'

// cachedResult keeps global per-namespace state; every test uses its own
// namespace so runs stay independent.
let namespaceCounter = 0
const nextNamespace = () => `table-pages:test-${namespaceCounter++}:prepared-rows`

const memory = { ttlMs: 60_000, maxEntries: 8 }

describe('prepareTableRows', () => {
	test('prepares once per (domain, version, signature) and serves repeats from memory', async () => {
		const namespace = nextNamespace()
		const prepare = vi.fn(async () => ['a', 'b'])
		const args = { namespace, domain: 'ethereum', version: 'v1', signature: 'sig-a', memory, prepare }

		expect(await prepareTableRows(args)).toEqual(['a', 'b'])
		expect(await prepareTableRows(args)).toEqual(['a', 'b'])
		expect(prepare).toHaveBeenCalledTimes(1)
	})

	test('keys separately by signature, version, and domain', async () => {
		const namespace = nextNamespace()
		const prepare = vi.fn(async () => ['rows'])
		const base = { namespace, domain: 'ethereum', version: 'v1', signature: 'sig-a', memory, prepare }

		await prepareTableRows(base)
		await prepareTableRows({ ...base, signature: 'sig-b' })
		await prepareTableRows({ ...base, version: 'v2' })
		await prepareTableRows({ ...base, domain: 'base' })

		expect(prepare).toHaveBeenCalledTimes(4)
	})

	test('coalesces concurrent callers onto one preparation', async () => {
		const namespace = nextNamespace()
		let resolve: (rows: Array<string>) => void = () => {}
		const prepare = vi.fn(() => new Promise<Array<string>>((r) => (resolve = r)))
		const args = { namespace, domain: 'all', version: 'v1', signature: 'sig', memory, prepare }

		const [first, second] = [prepareTableRows(args), prepareTableRows(args)]
		await vi.waitFor(() => expect(prepare).toHaveBeenCalled())
		resolve(['shared'])

		expect(await first).toEqual(['shared'])
		expect(await second).toEqual(['shared'])
		expect(prepare).toHaveBeenCalledTimes(1)
	})

	test('does not cache failed preparations', async () => {
		const namespace = nextNamespace()
		const prepare = vi
			.fn<() => Promise<Array<string>>>()
			.mockRejectedValueOnce(new Error('upstream down'))
			.mockResolvedValueOnce(['recovered'])
		const args = { namespace, domain: 'all', version: 'v1', signature: 'sig', memory, prepare }

		await expect(prepareTableRows(args)).rejects.toThrow('upstream down')
		expect(await prepareTableRows(args)).toEqual(['recovered'])
	})
})

describe('hashTableQuerySignature', () => {
	test('is fixed-width, url-safe, and collision-distinct for different signatures', () => {
		const a = hashTableQuerySignature('{"sort":"tvl"}')
		const b = hashTableQuerySignature('{"sort":"fees"}')
		expect(a).toHaveLength(22)
		expect(a).toMatch(/^[A-Za-z0-9_-]+$/)
		expect(a).not.toBe(b)
		expect(hashTableQuerySignature('{"sort":"tvl"}')).toBe(a)
	})
})
