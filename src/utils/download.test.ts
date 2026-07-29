import { describe, expect, it } from 'vitest'
import { addTimestampToFilename } from './download'

describe('addTimestampToFilename', () => {
	it('inserts the date before the final extension', () => {
		expect(addTimestampToFilename('bridge.activity.csv', '2026-07-28')).toBe('bridge.activity_2026-07-28.csv')
	})

	it('preserves a filename without an extension', () => {
		expect(addTimestampToFilename('bridge-activity', '2026-07-28')).toBe('bridge-activity_2026-07-28')
	})

	it('does not add the same date twice', () => {
		expect(addTimestampToFilename('bridge-activity_2026-07-28.csv', '2026-07-28')).toBe(
			'bridge-activity_2026-07-28.csv'
		)
	})
})
