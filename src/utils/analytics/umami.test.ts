import { describe, expect, test } from 'vitest'
import { AB_GROUP_COOKIE_NAME, getABGroup, getABTag } from '~/utils/abTesting'
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
			tag: getABTag('b')
		})
	})

	test('leaves payloads unchanged when no valid group exists', () => {
		const payload = { name: 'nav-click' }

		expect(addABTag(payload, `${AB_GROUP_COOKIE_NAME}=invalid`)).toBe(payload)
	})
})
