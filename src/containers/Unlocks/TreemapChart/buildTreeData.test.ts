import { describe, expect, test } from 'vitest'
import type { CalendarUnlockEvent, UnlocksData } from '~/containers/Unlocks/calendarTypes'
import { buildUnlocksTreemapTreeData } from './buildTreeData'

function event(protocol: string, value: number, unit?: 'week'): CalendarUnlockEvent {
	const fields = { protocol, value, details: '', unlockType: '' }
	return unit === 'week' ? { ...fields, unit } : fields
}

const unlocksData: UnlocksData = {
	'2025-12-01': { totalValue: 100, events: [event('Prior', 100)] },
	'2026-02-01': { totalValue: 15, events: [event('Alpha', 10), event('Beta', 5)] },
	'2026-02-20': { totalValue: 15, events: [event('Alpha', 15)] },
	'2026-03-01': { totalValue: 40, events: [event('Beta', 40), event('Weekly Rate', 1000, 'week')] },
	'2027-01-01': { totalValue: 12, events: [event('Gamma', 12)] }
}

describe('buildUnlocksTreemapTreeData', () => {
	test('builds only the selected month and aggregates protocols across its days', () => {
		const tree = buildUnlocksTreemapTreeData({
			unlocksData,
			timeView: 'Month',
			currentYear: 2026,
			selectedYear: '2026',
			selectedMonth: '02',
			isDark: false
		})

		expect(tree.map((node) => [node.name, node.value])).toEqual([
			['Alpha', 25],
			['Beta', 5]
		])
		expect(tree[0]!.label?.formatter).toContain('{name|Alpha}')
	})

	test('builds and sorts only the requested current-year month hierarchy', () => {
		const tree = buildUnlocksTreemapTreeData({
			unlocksData,
			timeView: 'Current Year',
			currentYear: 2026,
			selectedYear: '2026',
			selectedMonth: '02',
			isDark: false
		})

		expect(tree.map((node) => [node.name, node.value])).toEqual([
			['March', 40],
			['February', 30]
		])
		expect(tree[1]!.children?.map((node) => [node.name, node.value])).toEqual([
			['Alpha', 25],
			['Beta', 5]
		])
		expect(tree[0]!.upperLabel?.fontSize).toBe(13)
	})

	test('keeps current and future years in ascending order for the all-years hierarchy', () => {
		const tree = buildUnlocksTreemapTreeData({
			unlocksData,
			timeView: 'All Years',
			currentYear: 2026,
			selectedYear: '2026',
			selectedMonth: '02',
			isDark: true
		})

		expect(tree.map((node) => [node.name, node.value])).toEqual([
			['2026', 70],
			['2027', 12]
		])
		expect(tree[0]!.children?.map((node) => node.name)).toEqual(['March', 'February'])
		expect(tree[0]!.upperLabel?.fontSize).toBe(14)
		expect(tree[0]!.children?.[0]!.upperLabel?.fontSize).toBe(12)
	})

	test('returns no nodes when the requested current year has no unlocks', () => {
		expect(
			buildUnlocksTreemapTreeData({
				unlocksData,
				timeView: 'Current Year',
				currentYear: 2028,
				selectedYear: '2028',
				selectedMonth: '01',
				isDark: false
			})
		).toEqual([])
	})

	test('preserves source order when protocol or month values tie', () => {
		const tiedData: UnlocksData = {
			'2026-03-01': { totalValue: 10, events: [event('Zeta', 5), event('Alpha', 5)] },
			'2026-02-01': { totalValue: 10, events: [event('Beta', 10)] }
		}
		const input = {
			unlocksData: tiedData,
			currentYear: 2026,
			selectedYear: '2026',
			selectedMonth: '03',
			isDark: false
		} as const

		const month = buildUnlocksTreemapTreeData({ ...input, timeView: 'Month' })
		const currentYear = buildUnlocksTreemapTreeData({ ...input, timeView: 'Current Year' })
		const allYears = buildUnlocksTreemapTreeData({ ...input, timeView: 'All Years' })

		expect(month.map((node) => node.name)).toEqual(['Zeta', 'Alpha'])
		expect(currentYear.map((node) => node.name)).toEqual(['March', 'February'])
		expect(allYears[0]!.children?.map((node) => node.name)).toEqual(['March', 'February'])
	})
})
