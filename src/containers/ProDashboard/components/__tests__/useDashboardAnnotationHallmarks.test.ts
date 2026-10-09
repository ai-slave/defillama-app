import { describe, expect, test } from 'vitest'
import { annotationToHallmark } from '../useDashboardAnnotationHallmarks'

describe('annotationToHallmark', () => {
	test('converts a date to UTC seconds', () => {
		expect(annotationToHallmark({ id: 'a', date: '2024-01-01', label: 'Launch' })).toEqual([1_704_067_200, 'Launch'])
	})

	test('drops an unparsable date', () => {
		expect(annotationToHallmark({ id: 'a', date: 'not-a-date', label: 'Launch' })).toBeNull()
	})
})
