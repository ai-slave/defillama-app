import { getChartTheme } from '~/components/ECharts/shared/chartTheme'
import type { UnlocksData } from '~/containers/Unlocks/calendarTypes'
import { tokenIconUrl } from '~/utils/icons'
import { formatUsd } from '~/utils/numberFormat'

export const UNLOCKS_TREEMAP_TIME_VIEWS = ['Month', 'Current Year', 'All Years'] as const
export type UnlocksTreemapTimeView = (typeof UNLOCKS_TREEMAP_TIME_VIEWS)[number]

type ProtocolLabel = {
	show: true
	formatter: string
	position: 'inside'
	color: '#fff'
	rich: {
		icon: {
			height: number
			width: number
			align: 'center'
			backgroundColor: { image: string }
			lineHeight: number
		}
		name: {
			fontSize: number
			fontWeight: number
			color: '#fff'
			align: 'center'
			lineHeight: number
			padding: number[]
		}
		value: {
			fontSize: number
			fontWeight: number
			color: string
			align: 'center'
			lineHeight: number
		}
	}
}

type UpperLabel = {
	show: true
	formatter: string
	color: string
	fontSize: number
	fontWeight: number
}

export type UnlocksTreemapNode = {
	name: string
	value: number
	iconUrl?: string
	label?: ProtocolLabel
	upperLabel?: UpperLabel
	children?: UnlocksTreemapNode[]
}

type MonthInfo = {
	protocols: Record<string, number>
	value: number
}

type YearInfo = {
	months: Map<string, MonthInfo>
	value: number
}

function createProtocolTotals(): Record<string, number> {
	return {}
}

const MONTH_NAMES: Record<string, string> = {
	'01': 'January',
	'02': 'February',
	'03': 'March',
	'04': 'April',
	'05': 'May',
	'06': 'June',
	'07': 'July',
	'08': 'August',
	'09': 'September',
	'10': 'October',
	'11': 'November',
	'12': 'December'
}

function addEvents(month: MonthInfo, events: UnlocksData[string]['events'], year?: YearInfo): void {
	for (const event of events) {
		month.protocols[event.protocol] = (month.protocols[event.protocol] ?? 0) + event.value
		month.value += event.value
		if (year) year.value += event.value
	}
}

function buildProtocolNodes(protocols: Record<string, number>): UnlocksTreemapNode[] {
	const nodes: UnlocksTreemapNode[] = []
	for (const protocol in protocols) {
		const value = protocols[protocol]
		const iconUrl = tokenIconUrl(protocol)
		nodes.push({
			name: protocol,
			value,
			iconUrl,
			label: {
				show: true,
				formatter: `{icon|}\n{name|${protocol}}\n{value|${formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}}`,
				position: 'inside',
				color: '#fff',
				rich: {
					icon: {
						height: 22,
						width: 22,
						align: 'center',
						backgroundColor: { image: iconUrl },
						lineHeight: 26
					},
					name: {
						fontSize: 12,
						fontWeight: 600,
						color: '#fff',
						align: 'center',
						lineHeight: 16,
						padding: [2, 0, 0, 0]
					},
					value: {
						fontSize: 11,
						fontWeight: 500,
						color: 'rgba(255, 255, 255, 0.85)',
						align: 'center',
						lineHeight: 14
					}
				}
			}
		})
	}
	nodes.sort((a, b) => b.value - a.value)
	return nodes
}

function getMonth(year: YearInfo, monthName: string): MonthInfo {
	let month = year.months.get(monthName)
	if (!month) {
		month = { protocols: createProtocolTotals(), value: 0 }
		year.months.set(monthName, month)
	}
	return month
}

function buildMonthNodes(year: YearInfo, inkColor: string, fontSize: number): UnlocksTreemapNode[] {
	const monthNodes: UnlocksTreemapNode[] = []
	for (const [monthName, month] of year.months) {
		monthNodes.push({
			name: monthName,
			value: month.value,
			children: buildProtocolNodes(month.protocols),
			upperLabel: {
				show: true,
				formatter: `${monthName} - ${formatUsd(month.value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`,
				color: inkColor,
				fontSize,
				fontWeight: 600
			}
		})
	}
	monthNodes.sort((a, b) => b.value - a.value)
	return monthNodes
}

export function buildUnlocksTreemapTreeData({
	unlocksData,
	timeView,
	currentYear,
	selectedYear,
	selectedMonth,
	isDark
}: {
	unlocksData: UnlocksData
	timeView: UnlocksTreemapTimeView
	currentYear: number
	selectedYear: string
	selectedMonth: string
	isDark: boolean
}): UnlocksTreemapNode[] {
	if (timeView === 'Month') {
		const month: MonthInfo = { protocols: createProtocolTotals(), value: 0 }
		for (const date in unlocksData) {
			// The calendar data contract uses canonical YYYY-MM-DD keys.
			if (date.slice(0, 4) !== selectedYear || date.slice(5, 7) !== selectedMonth) continue
			addEvents(month, unlocksData[date].events)
		}
		return buildProtocolNodes(month.protocols)
	}

	const currentYearKey = String(currentYear)
	if (timeView === 'Current Year') {
		const year: YearInfo = { months: new Map(), value: 0 }
		for (const date in unlocksData) {
			if (date.slice(0, 4) !== currentYearKey) continue
			const month = getMonth(year, MONTH_NAMES[date.slice(5, 7)])
			addEvents(month, unlocksData[date].events, year)
		}
		return year.months.size ? buildMonthNodes(year, getChartTheme(isDark).ink(1), 13) : []
	}

	const years = new Map<string, YearInfo>()
	for (const date in unlocksData) {
		const yearKey = date.slice(0, 4)
		if (yearKey < currentYearKey) continue

		let year = years.get(yearKey)
		if (!year) {
			year = { months: new Map(), value: 0 }
			years.set(yearKey, year)
		}

		const month = getMonth(year, MONTH_NAMES[date.slice(5, 7)])
		addEvents(month, unlocksData[date].events, year)
	}

	if (!years.size) return []
	const inkColor = getChartTheme(isDark).ink(1)
	const yearNodes: UnlocksTreemapNode[] = []
	for (const [yearName, year] of years) {
		yearNodes.push({
			name: yearName,
			value: year.value,
			children: buildMonthNodes(year, inkColor, 12),
			upperLabel: {
				show: true,
				formatter: `${yearName} - ${formatUsd(year.value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`,
				color: inkColor,
				fontSize: 14,
				fontWeight: 700
			}
		})
	}
	yearNodes.sort((a, b) => a.name.localeCompare(b.name))
	return yearNodes
}
