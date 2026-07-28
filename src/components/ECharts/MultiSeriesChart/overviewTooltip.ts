import { formatRatio } from '~/utils/numberFormat'
import { formatTooltipChartDate, formatTooltipValue, type TooltipGroupBy } from '../shared/formatters'
import {
	getTooltipAxisValue,
	getTooltipRawYValue,
	normalizeTooltipItems,
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
	seriesValueSymbols: ReadonlyMap<string, string> | undefined
) {
	if (seriesName === 'Unlocks') return unlockTokenSymbol
	const seriesSymbol = seriesValueSymbols?.get(seriesName)
	if (seriesSymbol != null) return seriesSymbol
	if (seriesName.includes('Users')) return 'Addresses'
	if (seriesName.includes('Addresses')) return ''
	if (seriesName.includes('Transactions')) return 'TXs'
	if (seriesName === 'TVL' && valueSymbol !== '$') return valueSymbol
	if (seriesName in CHART_SYMBOLS) return CHART_SYMBOLS[seriesName]!
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
		const rows: Array<{ marker: string; name: string; value: number }> = []
		for (const item of items) {
			const name = item.seriesName
			if (!name) continue
			const rawValue = getTooltipRawYValue(item, name)
			const value = rawValue === '-' ? Number.NaN : typeof rawValue === 'number' ? rawValue : Number(rawValue)
			if (!Number.isFinite(value) || value === 0) continue
			rows.push({ marker: item.marker ?? '', name, value })
		}
		const othersIndex = rows.findIndex((row) => row.name === 'Others')
		const others = othersIndex >= 0 ? rows.splice(othersIndex, 1)[0] : null
		const hasOthers = others != null || rows.length > 10
		const topLimit = hasOthers ? 9 : 10
		let output = chartDate
		for (let index = 0; index < rows.length && index < topLimit; index++) {
			const row = rows[index]!
			output += `<li style="list-style:none">${row.marker}${row.name}&nbsp;&nbsp;${formatTooltipValue(
				row.value,
				getSeriesSymbol(row.name, valueSymbol, unlockTokenSymbol, seriesValueSymbols)
			)}</li>`
		}
		const mcap = rows.find((row) => row.name === 'Mcap')?.value
		const tvl = rows.find((row) => row.name === 'TVL')?.value
		if (mcap && tvl)
			output += `<li style="list-style:none">Mcap/TVL&nbsp;&nbsp;${formatRatio(mcap / tvl, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</li>`
		if (hasOthers) {
			let remainder = others?.value ?? 0
			for (let index = topLimit; index < rows.length; index++) remainder += rows[index]!.value
			output += `<li style="${TOOLTIP_OTHERS_ROW_STYLE}">${others?.marker ?? rows[topLimit]?.marker ?? ''}Others&nbsp;&nbsp;${formatTooltipValue(remainder, valueSymbol)}</li>`
		}
		return output
	}
}
