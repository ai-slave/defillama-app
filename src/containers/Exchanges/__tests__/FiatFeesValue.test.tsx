// @vitest-environment happy-dom
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

	test('names the route counts on the disclosure and shows a dash when fees are unknown', () => {
		const container = document.createElement('div')
		container.innerHTML = renderToStaticMarkup(<FiatFeesValue name="Venue" fees={FEES} />)
		const button = container.querySelector('button')
		expect(button?.getAttribute('aria-label')).toBe('Venue fiat fee details: 1 on-ramp routes and 0 off-ramp routes')
		expect(button?.textContent).toBe('1 in · 0 out')

		container.innerHTML = renderToStaticMarkup(<FiatFeesValue name="Venue" fees={null} />)
		expect(container.textContent).toBe('–')
	})
})
