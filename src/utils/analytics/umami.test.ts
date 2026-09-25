import { describe, expect, test } from 'vitest'
import { AB_GROUP_COOKIE_NAME, AB_VISITOR_COOKIE_NAME, getABClientAssignment, getABGroup } from '~/utils/abTesting'
import { addABTag } from './umami'

describe('addABTag', () => {
	test('uses the UUID final nibble for an even 50/50 split', () => {
		expect(getABGroup('00000000-0000-4000-8000-000000000007')).toBe('a')
		expect(getABGroup('00000000-0000-4000-8000-000000000008')).toBe('b')
	})

	test('adds the current a/b group without changing existing payload data', () => {
		const payload = { name: 'nav-click', data: { route: '/chains' } }

		expect(addABTag(payload, `theme=dark; ${AB_GROUP_COOKIE_NAME}=b`)).toEqual({
			...payload,
			tag: 'ab:foundation-aa-v1:b'
		})
	})

	test('leaves payloads unchanged when no valid group exists', () => {
		const payload = { name: 'nav-click' }

		expect(addABTag(payload, `${AB_GROUP_COOKIE_NAME}=invalid`)).toBe(payload)
	})
})

describe('getABClientAssignment', () => {
	test('creates a stable assignment when the proxy cookies are missing', () => {
		const visitorId = '00000000-0000-4000-8000-000000000008'

		expect(getABClientAssignment('theme=dark', () => visitorId)).toEqual({
			visitorId,
			group: 'b',
			shouldSetVisitorCookie: true
		})
	})

	test('restores the group from an existing client-readable visitor cookie', () => {
		const visitorId = '00000000-0000-4000-8000-000000000007'

		expect(getABClientAssignment(`${AB_VISITOR_COOKIE_NAME}=${visitorId}`, () => crypto.randomUUID())).toEqual({
			visitorId,
			group: 'a',
			shouldSetVisitorCookie: false
		})
	})

	test('keeps an existing group without generating another assignment', () => {
		let generated = false
		const assignment = getABClientAssignment(`${AB_GROUP_COOKIE_NAME}=a`, () => {
			generated = true
			return crypto.randomUUID()
		})

		expect(assignment).toBeNull()
		expect(generated).toBe(false)
	})
})
