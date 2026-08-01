import { afterEach, describe, expect, it, vi } from 'vitest'
import { getProtocolWarningBanners } from '../utils'

const protocolData = {
	rugged: false,
	deadUrl: false
}

describe('getProtocolWarningBanners', () => {
	afterEach(() => {
		vi.useRealTimers()
	})

	it('keeps unbounded and future warnings while excluding expired warnings', () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2026-07-30T00:00:00Z'))

		const result = getProtocolWarningBanners({
			...protocolData,
			warningBanners: [
				{ message: 'No expiry', level: 'low' },
				{ message: 'Forever', level: 'alert', until: 'forever' },
				{ message: 'Future date', level: 'low', until: '2026-08-01' },
				{ message: 'Future timestamp', level: 'low', until: 1_785_628_800 },
				{ message: 'Expired', level: 'low', until: '2026-07-01' }
			]
		})

		expect(result.map((banner) => banner.message)).toEqual(['No expiry', 'Forever', 'Future date', 'Future timestamp'])
	})
})
