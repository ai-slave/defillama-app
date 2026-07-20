import type { IProtocolChainBreakdownChart, IProtocolValueChart } from '~/containers/ProtocolOverview/api.types'
import {
	buildProtocolValueChartApiUrl,
	buildProtocolValueChartQueryKey
} from '~/containers/ProtocolOverview/valueChartSources'
import { fetchJson } from '~/utils/async'
import type { AdvancedTvlChartType, BorrowedChartType } from '../types'

export type ProtocolTvlBreakdownKind = 'chain' | 'token-usd' | 'token-raw'
export type SupportedProtocolTvlKey = 'pool2' | 'staking' | 'borrowed' | 'vesting'

export interface ProtocolTvlBreakdownRequest {
	protocol: string
	key?: SupportedProtocolTvlKey
	breakdownType: 'chain-breakdown' | 'token-breakdown'
	currency?: 'token'
}

export interface ProtocolTvlBreakdownSource {
	kind: ProtocolTvlBreakdownKind
	request: ProtocolTvlBreakdownRequest
}

// Advanced TVL cards compose individual protocol sections exposed by the breakdown API.
// Aggregate/table adjustment flags such as doublecounted, liquidstaking and govtokens
// are intentionally not breakdown sources here.
const SUPPORTED_EXTRA_TVL_KEYS: SupportedProtocolTvlKey[] = ['pool2', 'staking', 'borrowed', 'vesting']

export function fetchProtocolTvlValueForDashboard(protocol: string): Promise<IProtocolValueChart | null> {
	return fetchJson<IProtocolValueChart | null>(buildProtocolValueChartApiUrl({ source: 'tvl', protocol }))
}

export function getProtocolTvlValueQueryKey(protocol: string) {
	return buildProtocolValueChartQueryKey({ source: 'tvl', protocol })
}

export interface BorrowedBreakdownRequest extends ProtocolTvlBreakdownRequest {
	key: 'borrowed'
}

export interface BorrowedBreakdownSource {
	kind: ProtocolTvlBreakdownKind
	request: BorrowedBreakdownRequest
}

export function getBorrowedBreakdownSources(protocol: string, chartType: BorrowedChartType): BorrowedBreakdownSource[] {
	if (chartType === 'chainsBorrowed') {
		return [{ kind: 'chain', request: { protocol, key: 'borrowed', breakdownType: 'chain-breakdown' } }]
	}

	const sources: BorrowedBreakdownSource[] = [
		{ kind: 'token-usd', request: { protocol, key: 'borrowed', breakdownType: 'token-breakdown' } }
	]
	if (chartType === 'tokenBorrowedRaw') {
		sources.push({
			kind: 'token-raw',
			request: { protocol, key: 'borrowed', breakdownType: 'token-breakdown', currency: 'token' }
		})
	}
	return sources
}

export function shouldSuppressBorrowedTokenBreakdown(
	chartType: BorrowedChartType,
	misrepresentedTokens: boolean | undefined
) {
	return misrepresentedTokens === true && chartType !== 'chainsBorrowed'
}

export function shouldSuppressAdvancedTvlTokenBreakdown(
	chartType: AdvancedTvlChartType,
	misrepresentedTokens: boolean | undefined
) {
	return misrepresentedTokens === true && chartType !== 'tvl' && chartType !== 'chainsTvl'
}

export function getAdvancedTvlBreakdownSources(
	protocol: string,
	chartType: AdvancedTvlChartType,
	extraTvlsEnabled: Record<string, boolean>
): ProtocolTvlBreakdownSource[] {
	if (chartType === 'tvl') return []

	const keys: Array<SupportedProtocolTvlKey | undefined> = [undefined]
	for (const key of SUPPORTED_EXTRA_TVL_KEYS) {
		if (extraTvlsEnabled[key]) keys.push(key)
	}

	const sources: ProtocolTvlBreakdownSource[] = []
	for (const key of keys) {
		if (chartType === 'chainsTvl') {
			sources.push({ kind: 'chain', request: { protocol, key, breakdownType: 'chain-breakdown' } })
			continue
		}

		sources.push({ kind: 'token-usd', request: { protocol, key, breakdownType: 'token-breakdown' } })
		if (chartType === 'tokenBalances' || chartType === 'usdInflows' || chartType === 'tokenInflows') {
			sources.push({
				kind: 'token-raw',
				request: { protocol, key, breakdownType: 'token-breakdown', currency: 'token' }
			})
		}
	}

	return sources
}

export function getProtocolTvlBreakdownQueryKey(request: ProtocolTvlBreakdownRequest) {
	return buildProtocolValueChartQueryKey({ source: 'tvl', ...request })
}

export function fetchProtocolTvlBreakdownForDashboard(
	request: ProtocolTvlBreakdownRequest
): Promise<IProtocolChainBreakdownChart | null> {
	return fetchJson<IProtocolChainBreakdownChart | null>(buildProtocolValueChartApiUrl({ source: 'tvl', ...request }))
}

export function getBorrowedBreakdownQueryKey(request: BorrowedBreakdownRequest) {
	return getProtocolTvlBreakdownQueryKey(request)
}

export function fetchBorrowedBreakdownForDashboard(
	request: BorrowedBreakdownRequest
): Promise<IProtocolChainBreakdownChart | null> {
	return fetchProtocolTvlBreakdownForDashboard(request)
}
