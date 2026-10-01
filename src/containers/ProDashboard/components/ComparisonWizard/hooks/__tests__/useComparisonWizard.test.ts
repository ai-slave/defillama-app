import { describe, expect, test } from 'vitest'
import { createInitialWizardState } from '../useComparisonWizard'

describe('createInitialWizardState', () => {
	test('a preset with items opens on the metrics step with its trimmed items, at most ten', () => {
		const state = createInitialWizardState({
			hasActiveSubscription: true,
			comparisonPreset: {
				comparisonType: 'protocols',
				items: [' aave ', '', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k']
			}
		})
		expect([state.step, state.comparisonType, state.selectedItems]).toEqual([
			'select-metrics',
			'protocols',
			['aave', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']
		])
	})

	test('a preset without usable items opens on the items step for its type', () => {
		const state = createInitialWizardState({
			hasActiveSubscription: false,
			comparisonPreset: { comparisonType: 'chains', items: [' ', ''] }
		})
		expect([state.step, state.comparisonType, state.selectedItems]).toEqual(['select-items', 'chains', []])
	})

	test('without a preset the wizard opens on the type step', () => {
		const state = createInitialWizardState({ hasActiveSubscription: false, comparisonPreset: undefined })
		expect([state.step, state.comparisonType]).toEqual(['select-type', null])
	})
})
