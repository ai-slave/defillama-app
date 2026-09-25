import { describe, expect, test } from 'vitest'
import { annotationToHallmark, type ChartHallmark, mergeHallmarks } from '../useDashboardAnnotationHallmarks'

describe('annotationToHallmark', () => {
	test('converts a date to UTC seconds by default', () => {
		expect(annotationToHallmark({ id: 'a', date: '2024-01-01', label: 'Launch' })).toEqual([1_704_067_200, 'Launch'])
	})

	test('converts a date to milliseconds when the chart uses ms hallmarks', () => {
		expect(annotationToHallmark({ id: 'a', date: '2024-01-01', label: 'Launch' }, true)).toEqual([
			1_704_067_200_000,
			'Launch'
		])
	})

	test('drops an unparsable date', () => {
		expect(annotationToHallmark({ id: 'a', date: 'not-a-date', label: 'Launch' })).toBeNull()
	})
})

describe('mergeHallmarks', () => {
	const card: Array<ChartHallmark> = [[1_800_000_000, 'Today']]

	test('returns undefined when both sides are empty', () => {
		expect(mergeHallmarks(undefined, [])).toBeUndefined()
		expect(mergeHallmarks([], [])).toBeUndefined()
	})

	test('places card hallmarks first and annotations sorted by date', () => {
		const merged = mergeHallmarks(card, [
			[1_704_067_200, 'Later'],
			[1_672_531_200, 'Earlier']
		])
		expect(merged).toEqual([
			[1_800_000_000, 'Today'],
			[1_672_531_200, 'Earlier'],
			[1_704_067_200, 'Later']
		])
	})

	test('returns only sorted annotations when the card has none', () => {
		expect(
			mergeHallmarks(undefined, [
				[2, 'B'],
				[1, 'A']
			])
		).toEqual([
			[1, 'A'],
			[2, 'B']
		])
	})
})
