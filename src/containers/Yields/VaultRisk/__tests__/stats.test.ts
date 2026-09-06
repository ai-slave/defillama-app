// Committed-coverage policy math: what counts as a backstop a depositor can rely on.

import { describe, expect, test } from 'vitest'
import { applicableCoverageUsd } from '../stats'
import type { CoverageVM } from '../types'

describe('applicableCoverageUsd', () => {
	const cov = (access: CoverageVM['access'], capUsd: number, appliesTo: Array<string> = []): CoverageVM => ({
		kind: 'treasury',
		access,
		capUsd,
		rawCapUsd: capUsd,
		excludesOwnTokens: false,
		accessTimeSec: null,
		appliesTo,
		priority: 1
	})

	test('counts committed coverage that names the scenario, ignores layers that do not', () => {
		const c = [cov('instant', 100, ['smart-contract-bug']), cov('gov_vote', 50, ['oracle-hack-chainlink'])]
		expect(applicableCoverageUsd(c, 'smart-contract-bug')).toBe(100)
		expect(applicableCoverageUsd(c, 'oracle-hack-chainlink')).toBe(50)
		expect(applicableCoverageUsd(c, 'unlisted-scenario')).toBe(0)
	})

	test('never counts discretionary money as a backstop, even when it names the scenario', () => {
		// the Morpho Association treasury is discretionary → context, never a backstop
		const c = [cov('discretionary', 1_000_000, ['smart-contract-bug']), cov('instant', 100, ['smart-contract-bug'])]
		expect(applicableCoverageUsd(c, 'smart-contract-bug')).toBe(100)
	})

	test('does not credit unnamed (applies_to: []) coverage as a general backstop', () => {
		// committed, but names no scenario → context, not a backstop a depositor can count on
		expect(applicableCoverageUsd([cov('gov_vote', 500, [])], 'smart-contract-bug')).toBe(0)
	})
})
