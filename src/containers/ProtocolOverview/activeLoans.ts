import type { RuntimePieChartData } from '~/components/ECharts/PieChart/data'
import type { ProtocolBreakdownChart } from './useProtocolBreakdownCharts'

/**
 * What the Active Loans page body shows. With no breakdown and a failed request it shows nothing,
 * so the page's error panel is not contradicted by an "unavailable" empty state.
 */
export function getActiveLoansPanel(breakdown: {
	isLoading: boolean
	errorCount: number
	chainBreakdown: ProtocolBreakdownChart | null
	chainsUnique: Array<string>
	tokenBreakdownUSD: ProtocolBreakdownChart | null
	tokensUnique: Array<string>
	tokenBreakdownPieSeries: Pick<RuntimePieChartData, 'peers' | 'upstreamOthersValue'>
	tokenRawBreakdown: ProtocolBreakdownChart | null
	rawTokensUnique: Array<string>
}): 'loading' | 'charts' | 'empty' | 'none' {
	if (breakdown.isLoading) return 'loading'
	const hasBreakdown =
		(breakdown.chainBreakdown && breakdown.chainsUnique.length > 1) ||
		(breakdown.tokenBreakdownUSD && breakdown.tokensUnique.length > 0) ||
		breakdown.tokenBreakdownPieSeries.peers.length > 0 ||
		breakdown.tokenBreakdownPieSeries.upstreamOthersValue > 0 ||
		(breakdown.tokenRawBreakdown && breakdown.rawTokensUnique.length > 0)
	if (hasBreakdown) return 'charts'
	return breakdown.errorCount === 0 ? 'empty' : 'none'
}
