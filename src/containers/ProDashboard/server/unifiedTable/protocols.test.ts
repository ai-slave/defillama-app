import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { anyMock, oneMock } = vi.hoisted(() => ({
	anyMock: vi.fn(),
	oneMock: vi.fn()
}))

vi.mock('~/server/db/llama', () => ({
	llamaDb: {
		any: anyMock,
		one: oneMock
	}
}))

const totals = {
	tvl_base: 1,
	volume_dexs_1d: 1,
	volume_dexs_7d: 1,
	volume_aggregators_1d: 1,
	volume_aggregators_7d: 1,
	volume_derivatives_1d: 1,
	volume_aggr_derivatives_1d: 1,
	volume_options_1d: 1
}

const options = {
	config: {
		id: 'table',
		kind: 'unified-table' as const,
		rowHeaders: ['protocol' as const],
		params: null
	},
	rowHeaders: ['protocol' as const]
}

describe('unified table metric totals cache', () => {
	beforeEach(() => {
		vi.resetModules()
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2026-07-19T00:00:00Z'))
		anyMock.mockReset().mockResolvedValue([])
		oneMock.mockReset().mockResolvedValue(totals)
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('reuses totals briefly and refreshes them after the TTL', async () => {
		const { fetchProtocolsTable } = await import('./protocols')

		await fetchProtocolsTable(options)
		await fetchProtocolsTable(options)
		expect(oneMock).toHaveBeenCalledTimes(1)

		vi.setSystemTime(new Date('2026-07-19T00:05:01Z'))
		await fetchProtocolsTable(options)
		expect(oneMock).toHaveBeenCalledTimes(2)
	})

	it('clears a rejected totals request so the next call can retry', async () => {
		oneMock.mockRejectedValueOnce(new Error('temporary database failure')).mockResolvedValueOnce(totals)
		const { fetchProtocolsTable } = await import('./protocols')

		await expect(fetchProtocolsTable(options)).rejects.toThrow('temporary database failure')
		await expect(fetchProtocolsTable(options)).resolves.toEqual({ rows: [] })
		expect(oneMock).toHaveBeenCalledTimes(2)
	})
})
