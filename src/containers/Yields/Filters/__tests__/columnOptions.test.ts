import { describe, expect, test } from 'vitest'
import {
	EARN_NO_COLUMNS,
	NO_DEFAULT_EARN_COLUMNS,
	PAID_DEFAULT_EARN_COLUMNS,
	parseSelectedEarnColumns,
	resolveEarnColumnAccess
} from '../columnOptions'

describe('resolveEarnColumnAccess', () => {
	test('keeps a paid server seed active while client entitlement is pending', () => {
		expect(resolveEarnColumnAccess({ hasAccess: false, initialVerifiedAccess: true, isDenied: false })).toEqual({
			verifiedAccess: true,
			defaultColumns: PAID_DEFAULT_EARN_COLUMNS
		})
	})

	test('uses the settled client entitlement once access is known', () => {
		expect(resolveEarnColumnAccess({ hasAccess: true, initialVerifiedAccess: false, isDenied: false })).toEqual({
			verifiedAccess: true,
			defaultColumns: PAID_DEFAULT_EARN_COLUMNS
		})
		expect(resolveEarnColumnAccess({ hasAccess: false, initialVerifiedAccess: true, isDenied: true })).toEqual({
			verifiedAccess: false,
			defaultColumns: NO_DEFAULT_EARN_COLUMNS
		})
	})

	test('shows the paid columns to a locked reader while the Verified filter is on', () => {
		expect(
			resolveEarnColumnAccess({ hasAccess: false, initialVerifiedAccess: false, isDenied: true, verifiedFilter: true })
		).toEqual({
			verifiedAccess: false,
			defaultColumns: PAID_DEFAULT_EARN_COLUMNS
		})
	})
})

describe('parseSelectedEarnColumns', () => {
	test("falls back to the reader's defaults when the URL names none of our columns", () => {
		expect(parseSelectedEarnColumns(undefined)).toEqual([])
		expect(parseSelectedEarnColumns(undefined, PAID_DEFAULT_EARN_COLUMNS)).toEqual(['exitStatus'])
		// A value owned by another control is not a selection.
		expect(parseSelectedEarnColumns('someOtherParam', PAID_DEFAULT_EARN_COLUMNS)).toEqual(['exitStatus'])
	})

	test('lets a reader with defaults clear every column explicitly', () => {
		expect(parseSelectedEarnColumns(EARN_NO_COLUMNS, PAID_DEFAULT_EARN_COLUMNS)).toEqual([])
		expect(parseSelectedEarnColumns([EARN_NO_COLUMNS, 'foreign'], PAID_DEFAULT_EARN_COLUMNS)).toEqual([])
	})

	test('returns exactly what an explicit selection names, in column order', () => {
		expect(parseSelectedEarnColumns(['apyBase', 'category'], PAID_DEFAULT_EARN_COLUMNS)).toEqual([
			'category',
			'apyBase'
		])
		expect(parseSelectedEarnColumns(['exitStatus', EARN_NO_COLUMNS])).toEqual(['exitStatus'])
	})
})
