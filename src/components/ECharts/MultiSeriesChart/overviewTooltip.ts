import { formatRatio } from '~/utils/numberFormat'
import { escapeHtml } from '../shared/escapeHtml'
import { formatTooltipChartDate, formatTooltipValueHtml, type TooltipGroupBy } from '../shared/formatters'
import {
	getPointedSeriesName,
	getTooltipAxisValue,
	getTooltipRawYValue,
	normalizeTooltipItems,
	TOOLTIP_POINTED_ROW_STYLE
} from '../shared/tooltip'

const CHART_SYMBOLS: Record<string, string> = {
	'Active Addresses': '',
	'Returning Addresses': '',
	'New Addresses': '',
	Transactions: '',
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
	seriesValueSymbols: ReadonlyMap<string, string> | undefined
) {
	if (seriesName === 'Unlocks') return unlockTokenSymbol
	const seriesSymbol = seriesValueSymbols?.get(seriesName)
	if (seriesSymbol != null) return seriesSymbol
	if (seriesName.includes('Users')) return 'Addresses'
	if (seriesName.includes('Addresses')) return ''
	if (seriesName.includes('Transactions')) return 'TXs'
	if (seriesName === 'TVL' && valueSymbol !== '$') return valueSymbol
	const chartSymbol = Object.hasOwn(CHART_SYMBOLS, seriesName) ? CHART_SYMBOLS[seriesName] : undefined
	if (chartSymbol !== undefined) return chartSymbol
	return valueSymbol
}

/** Preserve overview tooltip ordering and special units while consuming canonical positional rows. */
export function createOverviewTooltipFormatter({
	groupBy = 'daily',
	valueSymbol,
	unlockTokenSymbol,
	seriesValueSymbols
}: {
	groupBy?: TooltipGroupBy
	valueSymbol: string
	unlockTokenSymbol: string
	seriesValueSymbols?: ReadonlyMap<string, string>
}) {
	return (params: unknown) => {
		const items = normalizeTooltipItems(params)
		if (items.length === 0) return ''
		const axisValue = getTooltipAxisValue(items[0])
		const chartDate = Number.isFinite(axisValue) ? formatTooltipChartDate(axisValue, groupBy) : ''
		const pointedName = getPointedSeriesName(items)
		let pointedLine = ''
		let rowLines = ''
		let mcap: number | null = null
		let tvl: number | null = null
		for (const item of items) {
			const name = item.seriesName
			if (!name) continue
			const rawValue = getTooltipRawYValue(item, name)
			const value = rawValue === '-' ? Number.NaN : typeof rawValue === 'number' ? rawValue : Number(rawValue)
			if (!Number.isFinite(value)) continue
			const row = `${item.marker ?? ''}${escapeHtml(name)}&nbsp;&nbsp;${formatTooltipValueHtml(
				value,
				getSeriesSymbol(name, valueSymbol, unlockTokenSymbol, seriesValueSymbols)
			)}`
			if (name === pointedName) pointedLine = `<li style="${TOOLTIP_POINTED_ROW_STYLE}">${row}</li>`
			else rowLines += `<li style="list-style:none">${row}</li>`
			if (name === 'Mcap' && mcap === null) mcap = value
			if (name === 'TVL' && tvl === null) tvl = value
		}
		let output = chartDate + pointedLine + rowLines
		if (mcap !== null && tvl !== null && tvl > 0)
			output += `<li style="list-style:none">Mcap/TVL&nbsp;&nbsp;${formatRatio(mcap / tvl, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</li>`
		return output
	}
}
