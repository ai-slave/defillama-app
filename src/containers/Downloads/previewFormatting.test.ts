import { describe, expect, it } from 'vitest'
import { downloadPreviewHasTime, formatDownloadPreviewDate } from './previewFormatting'

describe('Download preview date formatting', () => {
	it('distinguishes calendar-date columns from timestamp columns', () => {
		expect(downloadPreviewHasTime('date', ['2026-07-24', '2026-07-25'])).toBe(false)
		expect(downloadPreviewHasTime('updated_at', ['2026-07-24T16:30:00Z'])).toBe(true)
		expect(downloadPreviewHasTime('timestamp', ['2026-07-24'])).toBe(true)
	})

	it('decides date versus instant semantics for each cell in a mixed column', () => {
		const numericTimestamp = String(Date.UTC(2026, 6, 24, 16, 30))

		expect(formatDownloadPreviewDate('2026-07-24', 'timestamp')).toBe('Jul 24, 2026')
		expect(formatDownloadPreviewDate('2026-07-24T16:30:00Z', 'timestamp')).toMatch(
			/^Jul \d{1,2}, 2026, \d{1,2}:\d{2} [AP]M$/
		)
		expect(formatDownloadPreviewDate(numericTimestamp, 'updated_at')).toMatch(/, \d{1,2}:\d{2} [AP]M$/)
	})

	it('leaves timezone-ambiguous and unsupported date strings unchanged', () => {
		expect(formatDownloadPreviewDate('2026-07-24T16:30:00', 'timestamp')).toBeNull()
		expect(formatDownloadPreviewDate('07/24/2026', 'date')).toBeNull()
	})
})
