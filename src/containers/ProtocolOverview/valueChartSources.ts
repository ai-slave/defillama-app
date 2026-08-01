import type {
	ProtocolChartBreakdownType,
	ProtocolChartCurrency,
	ProtocolChartSelector,
	ProtocolTreasuryKey,
	ProtocolTvlKey
} from './api.types'

export type ProtocolValueChartSource = 'tvl' | 'treasury'
type ProtocolValueChartQueryKind = 'tvl-chart' | 'treasury-chart'

export interface CanonicalTokenExclusions {
	queryValue: string
}

export type ProtocolTvlValueChartRequest<TProtocol extends string | null = string> = {
	source: 'tvl'
	protocol: TProtocol
	key?: ProtocolTvlKey
	tokenExclusions?: CanonicalTokenExclusions
} & ProtocolChartSelector

export type ProtocolTreasuryValueChartRequest<TProtocol extends string | null = string> = {
	source: 'treasury'
	protocol: TProtocol
	key?: ProtocolTreasuryKey
} & ProtocolChartSelector

export type ProtocolValueChartRequest<TProtocol extends string | null = string> =
	| ProtocolTvlValueChartRequest<TProtocol>
	| ProtocolTreasuryValueChartRequest<TProtocol>

export type ProtocolValueChartQueryKey = [
	'protocol-overview',
	ProtocolValueChartQueryKind,
	string | null,
	string | undefined,
	ProtocolChartCurrency | undefined,
	ProtocolChartBreakdownType | undefined,
	string | undefined
]

const protocolValueChartSources = {
	tvl: { apiKind: 'tvl', queryKind: 'tvl-chart' },
	treasury: { apiKind: 'treasury', queryKind: 'treasury-chart' }
} satisfies Record<
	ProtocolValueChartSource,
	{ apiKind: ProtocolValueChartSource; queryKind: ProtocolValueChartQueryKind }
>

export const canonicalizeTokensToExclude = (
	tokensToExclude: ReadonlyArray<string> | undefined
): CanonicalTokenExclusions | undefined => {
	if (!tokensToExclude?.length) return undefined
	const queryValue = Array.from(new Set(tokensToExclude.filter((token) => token !== '')))
		.sort()
		.join(',')
	return queryValue ? { queryValue } : undefined
}

export const buildProtocolValueChartApiUrl = (request: ProtocolValueChartRequest) => {
	const searchParams = new URLSearchParams()
	searchParams.set('kind', protocolValueChartSources[request.source].apiKind)
	searchParams.set('protocol', request.protocol)
	if (request.key !== undefined) searchParams.set('key', request.key)
	if (request.currency !== undefined) searchParams.set('currency', request.currency)
	if (request.breakdownType !== undefined) searchParams.set('breakdownType', request.breakdownType)
	if (request.source === 'tvl' && request.tokenExclusions) {
		searchParams.set('tokensToExclude', request.tokenExclusions.queryValue)
	}
	return `/api/public/protocols/charts?${searchParams.toString()}`
}

export const buildProtocolValueChartQueryKey = (
	request: ProtocolValueChartRequest<string | null>
): ProtocolValueChartQueryKey => [
	'protocol-overview',
	protocolValueChartSources[request.source].queryKind,
	request.protocol,
	request.key,
	request.currency,
	request.breakdownType,
	request.source === 'tvl' ? request.tokenExclusions?.queryValue : undefined
]
