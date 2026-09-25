import { formatUsd, USD_LOWERCASE_MILLIONS_OPTIONS } from '~/utils/numberFormat'
import type {
	TokenRiskCandidate,
	TokenRiskChainExposureSummary,
	TokenRiskCoverageStatus,
	TokenRiskExposureSummary
} from './tokenRisk.types'

type ExposureTotals = Pick<TokenRiskExposureSummary, 'totalCurrentMaxBorrowUsd' | 'totalMinBadDebtAtPriceZeroUsd'>

function usd(value: number | null | undefined) {
	return formatUsd(value, USD_LOWERCASE_MILLIONS_OPTIONS)
}

/** At-risk exposure is what can still be borrowed plus the bad debt left if the collateral went to zero. */
export function getAtRiskExposureUsd(totals: ExposureTotals) {
	return totals.totalCurrentMaxBorrowUsd + (totals.totalMinBadDebtAtPriceZeroUsd ?? 0)
}

export function formatExposureBreakdown(totals: ExposureTotals, tokenSymbol: string) {
	const borrowable = `${usd(totals.totalCurrentMaxBorrowUsd) ?? 'Unavailable'} (max additional borrows against ${tokenSymbol})`
	if (totals.totalMinBadDebtAtPriceZeroUsd == null) return borrowable
	return `${borrowable} + ${usd(totals.totalMinBadDebtAtPriceZeroUsd) ?? 'Unavailable'} (bad debt if ${tokenSymbol} was hacked now)`
}

export function formatProtocolExposureSummary(totals: ExposureTotals, tokenSymbol: string) {
	return `${usd(getAtRiskExposureUsd(totals)) ?? 'Unavailable'} at-risk exposure = ${usd(totals.totalMinBadDebtAtPriceZeroUsd) ?? '--'} bad debt if hacked + ${usd(totals.totalCurrentMaxBorrowUsd) ?? 'Unavailable'} additional borrowable against ${tokenSymbol}`
}

export function formatProtocolChains(chainBreakdowns: Array<TokenRiskChainExposureSummary>) {
	if (chainBreakdowns.length === 0) return ''
	if (chainBreakdowns.length === 1) return chainBreakdowns[0]!.chainDisplayName
	return `${chainBreakdowns.length} chains`
}

export function formatMinBadDebtValue(value: number | null | undefined, coverage: TokenRiskCoverageStatus) {
	if (coverage === 'unavailable' || value == null) return '—'
	if (coverage === 'partial') return `${usd(value)} (partial)`
	return usd(value)
}

/** A single resolved chain names itself; several chains are described as onchain. */
export function getTokenRiskScopeLabel(scopeCandidates: Array<TokenRiskCandidate>) {
	return scopeCandidates.length === 1 ? scopeCandidates[0]!.displayName : 'onchain'
}
