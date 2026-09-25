import { describe, expect, test } from 'vitest'
import { getCriterionDrawerCopy } from '../criterionDrawerCopy'

describe('criterion drawer copy', () => {
	test('shows the mature-project AAA exception only for market maker criteria on their own axis', () => {
		const showsException = (axis: 'disclosure' | 'performance', key: string) =>
			getCriterionDrawerCopy(axis, key, key, null).showMarketMakerMaturityException

		expect(showsException('disclosure', 'mm_contract_transparency')).toBe(true)
		expect(showsException('performance', 'mm_uptime_sla')).toBe(true)
		expect(showsException('performance', 'mm_contract_transparency')).toBe(false)
		expect(showsException('disclosure', 'mm_volume_pct')).toBe(false)
		expect(showsException('disclosure', 'smart_contract_audits')).toBe(false)
	})

	test('falls back to API copy for criteria absent from the design copy table', () => {
		expect(getCriterionDrawerCopy('performance', 'future_metric', 'Future metric', 'API definition')).toEqual({
			navigationLabel: 'Future metric',
			heading: 'Future metric',
			definition: 'API definition',
			showMarketMakerMaturityException: false
		})
	})
})
