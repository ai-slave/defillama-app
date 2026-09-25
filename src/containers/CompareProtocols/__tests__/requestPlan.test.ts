import { describe, expect, test } from 'vitest'
import { V2_SERVER_URL } from '~/constants'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import {
	buildCompareProtocolTvlQuery,
	getCompareProtocolTvlSettings,
	normalizeCompareProtocolSelection
} from '../requestPlan'

const fixtureFetch = installFixtureFetch()

describe('CompareProtocols request planning', () => {
	test('requests the focused V2 TVL section chart by protocol slug', async () => {
		fixtureFetch.serve({ [`${V2_SERVER_URL}/chart/tvl/protocol/aave-v3?key=borrowed`]: [[1_700_000_000, 25]] })

		expect(await buildCompareProtocolTvlQuery('Aave V3', 'borrowed').queryFn()).toEqual([[1_700_000_000_000, 25]])
		expect(fixtureFetch.urls()).toEqual([`${V2_SERVER_URL}/chart/tvl/protocol/aave-v3?key=borrowed`])
	})

	test('scopes global TVL settings to the supported comparison sections', () => {
		expect(
			getCompareProtocolTvlSettings({
				borrowed: true,
				doublecounted: true,
				govtokens: true,
				liquidstaking: true,
				pool2: true,
				staking: false,
				vesting: true
			})
		).toEqual({
			borrowed: true,
			doublecounted: false,
			govtokens: false,
			liquidstaking: false,
			pool2: true,
			staking: false,
			vesting: true
		})
	})

	test('keeps the first occurrence of each nonblank URL selection', () => {
		const protocolNameBySlug = new Map([
			['aave', 'Aave'],
			['compound', 'Compound'],
			['aave-v3', 'Aave V3']
		])
		expect(
			normalizeCompareProtocolSelection(
				[' Aave ', '', 'Compound', 'aave', '   ', "'''", 'Compound', 'Aave V3', 'aave-v3', 'unknown-protocol'],
				protocolNameBySlug
			)
		).toEqual(['Aave', 'Compound', 'Aave V3', 'unknown-protocol'])
		expect(normalizeCompareProtocolSelection(undefined, protocolNameBySlug)).toEqual([])
	})
})
