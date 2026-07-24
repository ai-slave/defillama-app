import { describe, expect, it } from 'vitest'
import { formatMetadataAsOf } from './metadataPresentation'

describe('exchange metadata presentation', () => {
	it('formats the source full-date contract as a month period', () => {
		expect(formatMetadataAsOf('2026-07-01')).toBe('Jul 2026')
	})
})
