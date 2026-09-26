import { describe, expect, test } from 'vitest'
import type { DashboardItemConfig } from '../../dashboardItemConfig'
import type { DashboardItemLayout } from '../../types'
import {
	getDashboardItemHeight,
	getDashboardItemLayout,
	getEmbedCardHeight,
	getReadOnlyCardMinHeight,
	scaledCardHeight
} from '../cardHeight'

const chart = (extra: DashboardItemLayout = {}): DashboardItemConfig => ({
	id: 'chart',
	kind: 'chart',
	subjectType: 'chain',
	chain: 'Ethereum',
	type: 'tvl',
	...extra
})

describe('card height presets', () => {
	test('reads the stored height only for kinds that support it', () => {
		expect(getDashboardItemHeight(chart())).toBe('default')
		expect(getDashboardItemHeight(chart({ height: 'compact' }))).toBe('compact')
		expect(getDashboardItemHeight({ id: 'text', kind: 'text', content: 'x', height: 'tall' })).toBe('default')
		expect(getDashboardItemHeight({ id: 's', kind: 'section', title: 'S', displayAs: 'heading' })).toBe('default')
	})

	test('scaled heights are rounded pixel values', () => {
		expect(scaledCardHeight(300, undefined)).toBe(300)
		expect(scaledCardHeight(300, 'compact')).toBe(225)
		expect(scaledCardHeight(345, 'tall')).toBe(483)
		expect(scaledCardHeight(301, 'compact')).toBe(226)
	})

	test('layout extraction never emits undefined keys and ignores sections', () => {
		expect(getDashboardItemLayout(chart())).toEqual({})
		expect(getDashboardItemLayout(chart())).not.toHaveProperty('height')
		expect(getDashboardItemLayout(chart({ colSpan: 2, height: 'tall' }))).toEqual({ colSpan: 2, height: 'tall' })
		expect(getDashboardItemLayout(chart({ height: 'compact' }))).toEqual({ height: 'compact' })
		expect(getDashboardItemLayout({ id: 's', kind: 'section', title: 'S', displayAs: 'tab' })).toEqual({})
	})
})

// The embed iframe must fit the scaled card body plus the fixed, unscaled card header.
test('embed height scales the card body but not the header', () => {
	const defaultChart = chart()
	const tallChart = chart({ height: 'tall' })
	const header = getEmbedCardHeight(defaultChart) - getReadOnlyCardMinHeight(defaultChart)
	expect(header).toBeGreaterThan(0)
	expect(getReadOnlyCardMinHeight(tallChart)).toBe(scaledCardHeight(getReadOnlyCardMinHeight(defaultChart), 'tall'))
	expect(getEmbedCardHeight(tallChart)).toBe(getReadOnlyCardMinHeight(tallChart) + header)
	expect(getEmbedCardHeight(undefined)).toBe(getEmbedCardHeight(defaultChart))
})
