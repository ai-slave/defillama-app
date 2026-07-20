import { beforeEach, describe, expect, it, vi } from 'vitest'

const { feesMock } = vi.hoisted(() => ({ feesMock: vi.fn() }))

vi.mock('./services/ProtocolCharts', () => ({ default: { fees: feesMock } }))
vi.mock('./services/ChainCharts', () => ({ default: { tvl: vi.fn() } }))

import { getChartQueryFn } from './queries'

describe('getChartQueryFn protocol fallback', () => {
	beforeEach(() => {
		feesMock.mockReset()
	})

	it('preserves a standalone source error for React Query retries and error UI', async () => {
		feesMock.mockRejectedValue(new Error('upstream failed'))

		await expect(getChartQueryFn('fees', 'protocol', 'standalone')()).rejects.toThrow('upstream failed')
	})

	it('recovers a parent source failure by summing successful children', async () => {
		feesMock.mockImplementation(async (protocol: string) => {
			if (protocol === 'parent') throw new Error('no parent adapter')
			if (protocol === 'child-a') return [[1, 10]]
			return [
				[1, 20],
				[2, 5]
			]
		})

		const queryFn = getChartQueryFn(
			'fees',
			'protocol',
			'parent',
			undefined,
			undefined,
			new Map([['parent', ['child-a', 'child-b']]])
		)

		await expect(queryFn()).resolves.toEqual([
			[1, 30],
			[2, 5]
		])
	})
})
