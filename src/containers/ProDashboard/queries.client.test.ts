import { describe, expect, test } from 'vitest'
import { V2_SERVER_URL } from '~/constants'
import { installFixtureFetch, fixtureStatus } from '~/utils/test/fixtureFetch'
const http = installFixtureFetch()

import { getChartQueryFn } from './queries'

describe('getChartQueryFn protocol fallback', () => {
	test('preserves a standalone source error for React Query retries and error UI', async () => {
		http.serve({ [`${V2_SERVER_URL}/chart/fees/protocol/standalone`]: fixtureStatus(404) })

		await expect(getChartQueryFn('fees', 'protocol', 'standalone')()).rejects.toThrow(/404/)
	})

	test('recovers a parent source failure by summing successful children', async () => {
		http.serve({
			[`${V2_SERVER_URL}/chart/fees/protocol/parent`]: fixtureStatus(404),
			[`${V2_SERVER_URL}/chart/fees/protocol/child-a`]: [[1, 10]],
			[`${V2_SERVER_URL}/chart/fees/protocol/child-b`]: [
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
