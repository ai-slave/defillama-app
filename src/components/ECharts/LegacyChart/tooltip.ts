import { formatTooltipChartDate, formatTooltipValue, type TooltipGroupBy } from '../shared/formatters'
import {
	getTooltipAxisValue,
	getTooltipRawYValue,
	normalizeTooltipItems,
	type EChartsTooltipItem,
	TOOLTIP_OTHERS_ROW_STYLE
} from '../shared/tooltip'

const CHART_SYMBOLS: Record<string, string> = {
	'Active Addresses': '',
	'Returning Addresses': '',
	'New Addresses': '',
	Transactions: '',
	'Total Proposals': '',
	'Successful Proposals': '',
	'Max Votes': '',
	TVL: '$',
	APY: '%',
	'Median APY': '%',
	Treasury: '$',
	Tweets: '',
	Contributors: '',
	Developers: '',
	'Contributors Commits': '',
	Commits: '',
	'Devs Commits': ''
}

function getSeriesSymbol(
	seriesName: string,
	valueSymbol: string,
	unlockTokenSymbol: string,
	seriesValueSymbols: Record<string, string> | undefined
) {
	if (seriesName === 'Unlocks') return unlockTokenSymbol
	if (seriesValueSymbols && Object.hasOwn(seriesValueSymbols, seriesName)) return seriesValueSymbols[seriesName]
	if (seriesName.includes('Users')) return 'Addresses'
	if (seriesName.includes('Addresses')) return ''
	if (seriesName.includes('Transactions')) return 'TXs'
	if (seriesName === 'TVL' && valueSymbol !== '$') return valueSymbol
	if (seriesName in CHART_SYMBOLS) return CHART_SYMBOLS[seriesName]
	return valueSymbol
}

function getPositionalValues(item: EChartsTooltipItem | undefined): unknown[] | null {
	if (Array.isArray(item?.value)) return item.value
	if (Array.isArray(item?.data)) return item.data
	return null
}

/** Default tooltip retained only for ChainOverview and ProtocolOverview. */
export function createLegacyTooltipFormatter({
	groupBy = 'daily',
	valueSymbol,
	unlockTokenSymbol,
	seriesValueSymbols,
	tooltipSort,
	title
}: {
	groupBy?: TooltipGroupBy
	valueSymbol: string
	unlockTokenSymbol: string
	seriesValueSymbols?: Record<string, string>
	tooltipSort: boolean
	title?: string
}) {
	return (params: unknown) => {
		const items = normalizeTooltipItems(params)
		if (items.length === 0) return ''

		const firstX = getPositionalValues(items[0])?.[0]
		const axisValue = getTooltipAxisValue(items[0])
		const chartDate =
			typeof firstX === 'string' && !Number.isFinite(Number(firstX))
				? `<strong>${firstX}</strong><br/>`
				: Number.isFinite(axisValue)
					? formatTooltipChartDate(axisValue, groupBy)
					: ''

		const rows: Array<{
			item: EChartsTooltipItem
			name: string
			value: number
			displayValue: number
		}> = []
		for (const item of items) {
			const name = item.seriesName
			if (!name) continue
			const rawValue = getTooltipRawYValue(item, name)
			const value = rawValue === '-' ? Number.NaN : typeof rawValue === 'number' ? rawValue : Number(rawValue)
			if (!Number.isFinite(value) || value === 0) continue
			const displayRaw = getPositionalValues(item)?.[2]
			const numericDisplay = typeof displayRaw === 'number' ? displayRaw : Number(displayRaw)
			rows.push({
				item,
				name,
				value,
				displayValue: Number.isFinite(numericDisplay) ? numericDisplay : value
			})
		}
		if (tooltipSort) rows.sort((a, b) => Math.abs(b.value) - Math.abs(a.value))

		const explicitOthersIndex = rows.findIndex((row) => row.name === 'Others')
		const explicitOthers = explicitOthersIndex >= 0 ? rows.splice(explicitOthersIndex, 1)[0] : null
		const hasOthers = explicitOthers != null || rows.length > 10
		const topLimit = hasOthers ? 9 : 10
		const topRows = rows.slice(0, topLimit)
		const remainderRows = rows.slice(topLimit)

		let output = chartDate
		if (title && (title.toLowerCase() === 'tokens (usd)' || title.toLowerCase() === 'chains')) {
			let total = 0
			for (const row of rows) total += row.value
			if (explicitOthers) total += explicitOthers.value
			output += `<li style="list-style:none;font-weight:600">Total&nbsp;&nbsp;${formatTooltipValue(total, valueSymbol)}</li>`
		}

		for (const row of topRows) {
			output += `<li style="list-style:none">${row.item.marker ?? ''}${row.name}&nbsp;&nbsp;${formatTooltipValue(
				row.displayValue,
				getSeriesSymbol(row.name, valueSymbol, unlockTokenSymbol, seriesValueSymbols)
			)}</li>`
		}

		const mcap = rows.find((row) => row.name === 'Mcap')?.value
		const tvl = rows.find((row) => row.name === 'TVL')?.value
		if (mcap && tvl) {
			output += `<li style="list-style:none">Mcap/TVL&nbsp;&nbsp;${(mcap / tvl).toFixed(2)}</li>`
		}

		if (hasOthers) {
			let remainder = explicitOthers?.value ?? 0
			for (const row of remainderRows) remainder += row.value
			output += `<li style="${TOOLTIP_OTHERS_ROW_STYLE}">${explicitOthers?.item.marker ?? remainderRows[0]?.item.marker ?? ''}Others&nbsp;&nbsp;${formatTooltipValue(remainder, valueSymbol)}</li>`
		}

		return output
	}
}

/** Aggregate tooltip retained only for the two remaining legacy chart renderers. */
export function createAggregateTooltipFormatter({
	groupBy = 'daily',
	valueSymbol,
	totalLabel = 'Total'
}: {
	groupBy?: TooltipGroupBy
	valueSymbol: string
	totalLabel?: string
}) {
	return (params: unknown) => {
		const items = normalizeTooltipItems(params)
		if (items.length === 0) return ''
		const axisValue = getTooltipAxisValue(items[0])
		const chartdate = Number.isFinite(axisValue) ? formatTooltipChartDate(axisValue, groupBy) : ''
		const rows: Array<{ marker: string; name: string; value: number }> = []
		let total = 0
		for (const item of items) {
			const name = item.seriesName
			if (!name) continue
			const rawValue = getTooltipRawYValue(item, name)
			const value =
				rawValue == null || rawValue === '-' ? null : typeof rawValue === 'number' ? rawValue : Number(rawValue)
			if (value == null || Number.isNaN(value) || value === 0) continue
			rows.push({ marker: item.marker ?? '', name, value })
			total += value
		}

		rows.sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
		const othersIndex = rows.findIndex((row) => row.name === 'Others')
		const others = othersIndex >= 0 ? rows.splice(othersIndex, 1)[0] : null
		let output = chartdate
		output += `<li style="list-style:none;font-weight:600">${totalLabel}&nbsp;&nbsp;${formatTooltipValue(total, valueSymbol)}</li>`
		for (const row of rows) {
			output += `<li style="list-style:none">${row.marker}${row.name}&nbsp;&nbsp;${formatTooltipValue(row.value, valueSymbol)}</li>`
		}
		if (others) {
			output += `<li style="${TOOLTIP_OTHERS_ROW_STYLE}">${others.marker}${others.name}&nbsp;&nbsp;${formatTooltipValue(others.value, valueSymbol)}</li>`
		}
		return output
	}
}
