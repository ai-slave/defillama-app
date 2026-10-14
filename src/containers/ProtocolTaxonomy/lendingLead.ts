import { formatDate } from '~/utils/dateFormat'
import { formatNumber, formatUsd, USD_LOWERCASE_MILLIONS_OPTIONS } from '~/utils/numberFormat'
import type { ProtocolTaxonomyCharts } from './types'

export const LENDING_DEFINITION = 'Lending protocols let users borrow and lend assets.'
export const LENDING_QUESTION = 'What are DeFi lending protocols?'

export function categoryChartTvl(charts: ProtocolTaxonomyCharts): number | null {
	const index = charts.dataset.dimensions.indexOf('TVL')
	if (index < 0) return null
	const value = charts.dataset.source[charts.dataset.source.length - 1]?.[index]
	return typeof value === 'number' ? value : null
}

/** Definition first. The dated total is added only when the chart and the protocol list have it. */
export function lendingIntro(input: { dateSec: number; tvl: number | null; protocolCount: number }): string {
	const date = formatDate(input.dateSec, { input: 'seconds' })
	const tvl = input.tvl == null ? null : formatUsd(input.tvl, USD_LOWERCASE_MILLIONS_OPTIONS)
	const count = formatNumber(input.protocolCount)
	if (!date || !tvl || !count || input.protocolCount <= 0) return LENDING_DEFINITION
	return `${LENDING_DEFINITION} On ${date} the lending category held ${tvl} across ${count} protocols.`
}
