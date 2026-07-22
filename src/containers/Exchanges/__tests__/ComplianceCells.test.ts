import { describe, expect, it } from 'vitest'
import { getEuStatusPresentation, getKycRequirementIndicators, getMicaLicensePresentation } from '../ComplianceCells'

describe('exchange compliance presentation', () => {
	it('uses explicit semantic labels for every EU availability state', () => {
		expect(getEuStatusPresentation('available')).toMatchObject({ label: 'Available', tone: 'positive' })
		expect(getEuStatusPresentation('leaving')).toMatchObject({ label: 'Leaving', tone: 'caution' })
		expect(getEuStatusPresentation('restricted')).toMatchObject({ label: 'Restricted', tone: 'caution' })
		expect(getEuStatusPresentation('unavailable')).toMatchObject({ label: 'Unavailable', tone: 'negative' })
	})

	it('presents MiCA authorization rather than exposing the record status', () => {
		const details = { memberState: 'Austria', regulator: 'FMA' }
		expect(getMicaLicensePresentation({ status: 'active', licensed: true, ...details })).toMatchObject({
			label: 'Licensed',
			tone: 'positive'
		})
		expect(getMicaLicensePresentation({ status: 'in-progress', licensed: false, ...details })).toMatchObject({
			label: 'In progress',
			tone: 'caution'
		})
		expect(getMicaLicensePresentation({ status: 'active', licensed: null, ...details })).toBeNull()
	})

	it('shares the MiCA KYC icon vocabulary for directory requirements', () => {
		expect(getKycRequirementIndicators('ID + selfie + PoA').map(({ label }) => label)).toEqual([
			'Government ID',
			'Liveness / selfie check',
			'Proof of address'
		])
	})
})
