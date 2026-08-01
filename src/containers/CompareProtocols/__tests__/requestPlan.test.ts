import { describe, expect, it } from 'vitest'
import {
	buildCompareProtocolTvlRequestPlan,
	getCompareProtocolExtraTvlKeys,
	getCompareProtocolTvlSettings,
	normalizeCompareProtocolSelection
} from '../requestPlan'

describe('CompareProtocols request planning', () => {
	it('uses the focused V2 TVL route inputs instead of the full protocol payload', () => {
		expect(buildCompareProtocolTvlRequestPlan('Aave V3', 'borrowed')).toEqual({
			protocolSlug: 'aave-v3',
			queryKey: ['protocol-overview', 'tvl-chart', 'aave-v3', 'borrowed', undefined, undefined, undefined]
		})
	})

	it('only plans additive individual-protocol TVL sections', () => {
		expect(
			getCompareProtocolExtraTvlKeys({
				borrowed: true,
				doublecounted: true,
				govtokens: true,
				liquidstaking: true,
				pool2: true,
				staking: true,
				vesting: true
			})
		).toEqual(['pool2', 'staking', 'borrowed', 'vesting'])
	})

	it('scopes global TVL settings to the supported comparison sections', () => {
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

	it('keeps the first occurrence of each nonblank URL selection', () => {
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
