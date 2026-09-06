import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { FiatFeesValue, fiatFeeSummary } from '../FiatFeesValue'
import type { ExchangeFiatFees } from '../models'

const FEES: ExchangeFiatFees = {
	onRamp: [
		{
			currency: 'EUR',
			fee: 'Free',
			method: 'SEPA',
			minimum: '€1',
			note: 'Bank fees may apply.',
			source: { label: 'Source', url: 'https://example.com/source' },
			processingTime: '1-2 business days'
		}
	],
	offRamp: []
}

describe('FiatFeesValue', () => {
	test('summarizes exact authored on-ramp and off-ramp rows', () => {
		expect(fiatFeeSummary(FEES)).toBe('1 in · 0 out')
	})

	test('renders an accessible compact disclosure and an unavailable state', () => {
		const available = renderToStaticMarkup(<FiatFeesValue name="Venue" fees={FEES} />)
		const missing = renderToStaticMarkup(<FiatFeesValue name="Venue" fees={null} />)

		expect(available).toContain('aria-label="Venue fiat fee details: 1 on-ramp routes and 0 off-ramp routes"')
		expect(available).toContain('1 in · 0 out')
		expect(missing).toContain('–')
	})
})
