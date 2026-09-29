import { describe, expect, test } from 'vitest'
import { V2_SERVER_URL } from '~/constants'
import { installFixtureFetch, fixtureStatus } from '~/utils/testing/fixtureFetch'
const http = installFixtureFetch()

import { buildProDashboardProtocolRelations } from '../protocolCatalog'
import { getChartQueryFn } from '../queries'
import type { Protocol } from '../types'

const catalogProtocol = (slug: string, parentProtocol: string | null, flags: Partial<Protocol> = {}): Protocol => ({
	id: slug,
	name: slug,
	slug,
	tvl: 0,
	chains: [],
	parentProtocol,
	...flags
})
const relations = (protocols: Array<Protocol>) => buildProDashboardProtocolRelations({ protocols, chains: [] })

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
			relations([
				catalogProtocol('parent', null),
				catalogProtocol('child-a', 'parent'),
				catalogProtocol('child-b', 'parent')
			])
		)

		await expect(queryFn()).resolves.toEqual([
			[1, 30],
			[2, 5]
		])
	})

	test.each([
		['openInterest', [[1, 80]]],
		['optionsOpenInterest', [[1, 1600]]]
	] as const)('reads a parent %s from its children flagged for it', async (type, expected) => {
		const chart = (slug: string) => `${V2_SERVER_URL}/chart/open-interest/protocol/${slug}?dataType=openInterestAtEnd`
		http.serve({
			[chart('derive')]: [[1, 1680]],
			[chart('derive-v2')]: [[1, 80]],
			[chart('derive-options')]: [[1, 1600]]
		})

		const queryFn = getChartQueryFn(
			type,
			'protocol',
			'derive',
			undefined,
			undefined,
			relations([
				catalogProtocol('derive', null),
				catalogProtocol('derive-v2', 'derive', { openInterest: true }),
				catalogProtocol('derive-options', 'derive', { optionsOpenInterest: true })
			])
		)

		await expect(queryFn()).resolves.toEqual(expected)
	})

	test('reads open interest of a parent without options children from its own chart', async () => {
		const chart = (slug: string) => `${V2_SERVER_URL}/chart/open-interest/protocol/${slug}?dataType=openInterestAtEnd`
		http.serve({ [chart('gmx')]: [[1, 40]] })

		const queryFn = getChartQueryFn(
			'openInterest',
			'protocol',
			'gmx',
			undefined,
			undefined,
			relations([catalogProtocol('gmx', null), catalogProtocol('gmx-v2', 'gmx', { openInterest: true })])
		)

		await expect(queryFn()).resolves.toEqual([[1, 40]])
	})
})
