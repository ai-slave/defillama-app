import type {
	IProtocolChainBreakdownChart,
	IProtocolTokenBreakdownChart,
	IProtocolValueChart
} from '~/containers/ProtocolOverview/api.types'
import {
	buildProtocolValueChartApiUrl,
	buildProtocolValueChartQueryKey
} from '~/containers/ProtocolOverview/valueChartSources'
import { fetchJson } from '~/utils/async'
import type { AdvancedTvlChartType, BorrowedChartType } from '../types'

export type SupportedProtocolTvlKey = 'pool2' | 'staking' | 'borrowed' | 'vesting'

type ProtocolTvlBreakdownRequestBase = {
	protocol: string
	key?: SupportedProtocolTvlKey
}

type ProtocolTvlChainBreakdownRequest = ProtocolTvlBreakdownRequestBase & {
	breakdownType: 'chain-breakdown'
	currency?: never
}

type ProtocolTvlTokenUsdBreakdownRequest = ProtocolTvlBreakdownRequestBase & {
	breakdownType: 'token-breakdown'
	currency?: never
}

type ProtocolTvlTokenRawBreakdownRequest = ProtocolTvlBreakdownRequestBase & {
	breakdownType: 'token-breakdown'
	currency: 'token'
}

export type ProtocolTvlBreakdownRequest =
	| ProtocolTvlChainBreakdownRequest
	| ProtocolTvlTokenUsdBreakdownRequest
	| ProtocolTvlTokenRawBreakdownRequest

export type ProtocolTvlBreakdownChart = IProtocolChainBreakdownChart | IProtocolTokenBreakdownChart

export type ProtocolTvlBreakdownSource =
	| { kind: 'chain'; request: ProtocolTvlChainBreakdownRequest }
	| { kind: 'token-usd'; request: ProtocolTvlTokenUsdBreakdownRequest }
	| { kind: 'token-raw'; request: ProtocolTvlTokenRawBreakdownRequest }

// Advanced TVL cards compose individual protocol sections exposed by the breakdown API.
// Aggregate/table adjustment flags such as doublecounted, liquidstaking and govtokens
// are intentionally not breakdown sources here.
const SUPPORTED_EXTRA_TVL_KEYS: SupportedProtocolTvlKey[] = ['pool2', 'staking', 'borrowed', 'vesting']

export function fetchProtocolTvlValueForDashboard(protocol: string): Promise<IProtocolValueChart> {
	return fetchJson<IProtocolValueChart>(buildProtocolValueChartApiUrl({ source: 'tvl', protocol }))
}

export function getProtocolTvlValueQueryKey(protocol: string) {
	return buildProtocolValueChartQueryKey({ source: 'tvl', protocol })
}

export type BorrowedBreakdownRequest = ProtocolTvlBreakdownRequest & { key: 'borrowed' }

export type BorrowedBreakdownSource =
	| { kind: 'chain'; request: ProtocolTvlChainBreakdownRequest & { key: 'borrowed' } }
	| { kind: 'token-usd'; request: ProtocolTvlTokenUsdBreakdownRequest & { key: 'borrowed' } }
	| { kind: 'token-raw'; request: ProtocolTvlTokenRawBreakdownRequest & { key: 'borrowed' } }

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
		const requestKey = key === undefined ? {} : { key }
		if (chartType === 'chainsTvl') {
			sources.push({ kind: 'chain', request: { protocol, ...requestKey, breakdownType: 'chain-breakdown' } })
			continue
		}

		sources.push({ kind: 'token-usd', request: { protocol, ...requestKey, breakdownType: 'token-breakdown' } })
		if (chartType === 'tokenBalances' || chartType === 'usdInflows' || chartType === 'tokenInflows') {
			sources.push({
				kind: 'token-raw',
				request: { protocol, ...requestKey, breakdownType: 'token-breakdown', currency: 'token' }
			})
		}
	}

	return sources
}

export function getProtocolTvlBreakdownQueryKey(request: ProtocolTvlBreakdownRequest) {
	return buildProtocolValueChartQueryKey({ source: 'tvl', ...request })
}

export function fetchProtocolTvlBreakdownForDashboard(
	request: ProtocolTvlChainBreakdownRequest
): Promise<IProtocolChainBreakdownChart>
export function fetchProtocolTvlBreakdownForDashboard(
	request: ProtocolTvlTokenUsdBreakdownRequest | ProtocolTvlTokenRawBreakdownRequest
): Promise<IProtocolTokenBreakdownChart>
export function fetchProtocolTvlBreakdownForDashboard(
	request: ProtocolTvlBreakdownRequest
): Promise<ProtocolTvlBreakdownChart>
export async function fetchProtocolTvlBreakdownForDashboard(
	request: ProtocolTvlBreakdownRequest
): Promise<ProtocolTvlBreakdownChart> {
	const url = buildProtocolValueChartApiUrl({ source: 'tvl', ...request })
	if (request.breakdownType === 'chain-breakdown') return fetchJson<IProtocolChainBreakdownChart>(url)
	return fetchJson<IProtocolTokenBreakdownChart>(url)
}

export function getBorrowedBreakdownQueryKey(request: BorrowedBreakdownRequest) {
	return getProtocolTvlBreakdownQueryKey(request)
}

export function fetchBorrowedBreakdownForDashboard(
	request: BorrowedBreakdownRequest
): Promise<ProtocolTvlBreakdownChart> {
	return fetchProtocolTvlBreakdownForDashboard(request)
}
