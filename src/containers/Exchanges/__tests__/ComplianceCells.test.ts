import { describe, expect, test } from 'vitest'
import {
	eeaOrderbookTooltip,
	getEuStatusPresentation,
	getKycRequirementIndicators,
	getMicaLicensePresentation
} from '../ComplianceCells'

describe('exchange compliance presentation', () => {
	test('colors each EU availability state by how usable the exchange is', () => {
		expect(getEuStatusPresentation('available').status).toBe('good')
		expect(getEuStatusPresentation('leaving').status).toBe('caution')
		expect(getEuStatusPresentation('restricted').status).toBe('caution')
		expect(getEuStatusPresentation('unavailable').status).toBe('bad')
	})

	test('presents MiCA authorization rather than exposing the record status', () => {
		const details = { memberState: 'Austria', regulator: 'FMA' }
		expect(getMicaLicensePresentation({ status: 'active', licensed: true, ...details })).toMatchObject({
			label: 'Licensed',
			status: 'good'
		})
		expect(getMicaLicensePresentation({ status: 'in-progress', licensed: false, ...details })).toMatchObject({
			label: 'In progress',
			status: 'caution'
		})
		expect(getMicaLicensePresentation({ status: 'active', licensed: null, ...details })).toBeNull()
	})

	test('shares the MiCA KYC icon vocabulary for directory requirements', () => {
		expect(getKycRequirementIndicators('ID + selfie + PoA').map(({ label }) => label)).toEqual([
			'Government ID',
			'Liveness / selfie check',
			'Proof of address'
		])
	})

	test('describes EEA orderbook ownership per segment', () => {
		expect(eeaOrderbookTooltip({ mode: 'own' })).toBe('Uses dedicated regional orderbooks.')
		expect(eeaOrderbookTooltip({ mode: 'shared' })).toBe('Shares the global orderbook.')
		expect(eeaOrderbookTooltip({ mode: 'mixed', sharedSegments: ['spot'], dedicatedSegments: ['linear_perp'] })).toBe(
			'Shared: Spot. Dedicated: USD Perps.'
		)
		expect(eeaOrderbookTooltip(null)).toBeNull()
	})
})
