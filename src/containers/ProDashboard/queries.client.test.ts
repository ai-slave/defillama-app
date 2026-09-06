import { beforeEach, describe, expect, test, vi } from 'vitest'

const { getProtocolDataMock } = vi.hoisted(() => ({ getProtocolDataMock: vi.fn() }))

vi.mock('./services/ProtocolCharts', () => ({ fetchProProtocolChartData: getProtocolDataMock }))
vi.mock('./services/ChainCharts', () => ({ fetchProChainChartData: vi.fn() }))

import { getChartQueryFn } from './queries'

describe('getChartQueryFn protocol fallback', () => {
	beforeEach(() => {
		getProtocolDataMock.mockReset()
	})

	test('preserves a standalone source error for React Query retries and error UI', async () => {
		getProtocolDataMock.mockRejectedValue(new Error('upstream failed'))

		await expect(getChartQueryFn('fees', 'protocol', 'standalone')()).rejects.toThrow('upstream failed')
	})

	test('recovers a parent source failure by summing successful children', async () => {
		getProtocolDataMock.mockImplementation(async (_type: string, protocol: string) => {
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
