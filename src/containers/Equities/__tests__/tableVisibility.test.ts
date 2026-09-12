import type { ColumnVisibilityState } from '@tanstack/react-table'
import { describe, expect, test } from 'vitest'
import type { EquityActiveFilter } from '../filters'
import {
	applyEquityFilterColumnVisibility,
	getEquityFilterDefaultSorting,
	shouldUpdateEquityFilterDefaultSorting
} from '../tableVisibility'

const cashFilter: EquityActiveFilter = {
	kind: 'numeric',
	id: 'cashAndCashEquivalents',
	operator: '>',
	value: 10_000_000_000
}

describe('equity filter column visibility', () => {
	test('forces active filter columns visible in the table', () => {
		const columnVisibility: ColumnVisibilityState = {
			cashAndCashEquivalents: false,
			totalDebt: false
		}

		expect(applyEquityFilterColumnVisibility({ columnVisibility, filters: [cashFilter] })).toEqual({
			cashAndCashEquivalents: true,
			totalDebt: false,
			searchPriority: false
		})
	})

	test('leaves the user-picked visibility untouched when there are no active filters', () => {
		const columnVisibility: ColumnVisibilityState = {
			cashAndCashEquivalents: false,
			totalDebt: true
		}

		expect(applyEquityFilterColumnVisibility({ columnVisibility, filters: [] })).toEqual({
			cashAndCashEquivalents: false,
			totalDebt: true,
			searchPriority: false
		})
	})
})

describe('equity filter default sorting', () => {
	test('sorts by the latest numeric filter, descending for lower-bound filters', () => {
		expect(
			getEquityFilterDefaultSorting({
				filters: [{ kind: 'numeric', id: 'marketCap', operator: '>=', value: 10_000_000_000 }, cashFilter],
				fallbackSorting: [{ id: 'marketCap', desc: true }]
			})
		).toEqual([{ id: 'cashAndCashEquivalents', desc: true }])
	})

	test('sorts ascending for upper-bound filters', () => {
		expect(
			getEquityFilterDefaultSorting({
				filters: [{ kind: 'numeric', id: 'trailingPE', operator: '<=', value: 20 }],
				fallbackSorting: [{ id: 'marketCap', desc: true }]
			})
		).toEqual([{ id: 'trailingPE', desc: false }])
	})

	test('falls back to preset sorting when there are no numeric filters', () => {
		const fallbackSorting = [{ id: 'marketCap', desc: true }]
		expect(
			getEquityFilterDefaultSorting({
				filters: [{ kind: 'categorical', id: 'sector', mode: 'include', values: ['Technology'] }],
				fallbackSorting
			})
		).toBe(fallbackSorting)
	})

	test('updates managed default sorting but preserves manual sorting', () => {
		const fallbackSorting = [{ id: 'marketCap', desc: true }]
		expect(
			shouldUpdateEquityFilterDefaultSorting({
				currentSorting: fallbackSorting,
				previousFilters: [],
				fallbackSorting
			})
		).toBe(true)
		expect(
			shouldUpdateEquityFilterDefaultSorting({
				currentSorting: [{ id: 'volume', desc: true }],
				previousFilters: [],
				fallbackSorting
			})
		).toBe(false)
	})
})
