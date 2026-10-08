import { chartColor, OTHERS_COLOR } from '~/constants/colors'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import type { ChartConfig } from '../types'

/** A protocol and a chain can share a name, so the subject type is part of the key. */
export function getChartEntityKey(chart: ChartConfig): string {
	return chart.subjectType === 'protocol' ? `protocol:${chart.protocol}` : `chain:${chart.chain}`
}

/**
 * The colour of every protocol and chain the dashboard's chart cards draw, so an entity looks the same on every
 * card. Entities take the palette in order of first appearance, so no two share a colour until there are more than
 * the palette holds. Derived from the items alone, so the server and the client agree.
 */
export function getDashboardEntityColors(items: ReadonlyArray<DashboardItemConfig>): Record<string, string> {
	const colors: Record<string, string> = {}
	let count = 0
	const add = (chart: ChartConfig) => {
		const key = getChartEntityKey(chart)
		if (colors[key] === undefined) colors[key] = chartColor(count++)
	}
	for (const item of items) {
		if (item.kind === 'chart') add(item)
		else if (item.kind === 'multi') for (const chart of item.items) add(chart)
	}
	return colors
}

/**
 * Series colours of a combined card, by item id. Each series takes its entity's dashboard colour while those stay
 * distinct in the card; when an entity repeats (one protocol, several metrics) or the palette has wrapped, the card
 * colours its series by rank instead. A colour the user chose always wins.
 */
export function getMultiChartSeriesColors(
	items: ReadonlyArray<ChartConfig>,
	entityColors: Record<string, string>
): Record<string, string> {
	const dashboardColors = items.map((item) => entityColors[getChartEntityKey(item)])
	const distinct = new Set(dashboardColors).size === dashboardColors.length
	const colors: Record<string, string> = {}
	for (const [index, item] of items.entries()) {
		colors[item.id] = item.color ?? (distinct ? dashboardColors[index] : chartColor(index))
	}
	return colors
}

/** Stablecoin brand colours, kept over the palette because readers know them. */
export const STABLECOIN_TOKEN_COLORS: Record<string, string> = {
	USDT: '#009393',
	Tether: '#009393',
	USDC: '#2775CA',
	'USD Coin': '#2775CA',
	DAI: '#F4B731',
	Dai: '#F4B731',
	USDe: '#3A3A3A',
	'Ethena USDe': '#3A3A3A',
	BUIDL: '#111111',
	USD1: '#D2B48C',
	USDS: '#1BAB9B',
	'Sky Dollar': '#1BAB9B',
	PYUSD: '#0070E0',
	'PayPal USD': '#0070E0',
	USDTB: '#C0C0C0',
	FDUSD: '#00D395',
	Others: OTHERS_COLOR
}
