import { describe, expect, test } from 'vitest'
import { resolveResearchView } from '../researchPresentation'

describe('research chart presentation', () => {
	test('keeps URL-selected views within the metric that supports them', () => {
		expect(resolveResearchView('depth', 'btc-depth')).toBe('btc-depth')
		expect(resolveResearchView('nvol', 'survival-usd-exchanges')).toBe('survival-usd-exchanges')
		expect(resolveResearchView('volume', 'btc-depth')).toBe('spot-exchanges')
		expect(resolveResearchView('oi', 'survival-spot-exchanges')).toBe('open-interest-base-share')
	})
})
