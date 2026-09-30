// @vitest-environment happy-dom

import { beforeEach, describe, expect, test } from 'vitest'
import { captureFirstTouchUtm, getSignupAttribution } from '~/auth/signupAttribution'
import { AB_SEED_COOKIE_NAME } from '~/utils/abTesting'

const SEED = '00000000-0000-4000-8000-00000000000a'

describe('signup attribution', () => {
	beforeEach(() => {
		localStorage.clear()
		document.cookie = `${AB_SEED_COOKIE_NAME}=; Max-Age=0; Path=/`
	})

	test('keeps the first utm a visitor arrived with, so a newsletter click still gets credit after browsing', () => {
		captureFirstTouchUtm('?utm_source=newsletter&utm_medium=email&utm_campaign=sep-29')
		captureFirstTouchUtm('?utm_source=twitter')

		expect(getSignupAttribution()).toEqual({
			utmSource: 'newsletter',
			utmMedium: 'email',
			utmCampaign: 'sep-29'
		})
	})

	test('ignores visits without utm so a plain page view does not erase earlier campaign credit', () => {
		captureFirstTouchUtm('?utm_source=newsletter')
		captureFirstTouchUtm('?page=2')

		expect(getSignupAttribution().utmSource).toBe('newsletter')
	})

	test('adds the visitor seed so the new account joins its signed-out history', () => {
		document.cookie = `${AB_SEED_COOKIE_NAME}=${SEED}; Path=/`

		expect(getSignupAttribution()).toEqual({ abVisitorId: SEED })
	})

	test('caps utm values so a crafted link cannot push long strings into the account record', () => {
		captureFirstTouchUtm(`?utm_source=${'x'.repeat(500)}`)

		expect(getSignupAttribution().utmSource).toHaveLength(100)
	})
})
