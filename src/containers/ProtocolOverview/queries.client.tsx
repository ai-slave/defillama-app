import { useQueries, useQuery } from '@tanstack/react-query'
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query'
import { useMemo } from 'react'
import { fetchJson } from '~/utils/async'
import type {
	IProtocolChainBreakdownChart,
	IProtocolMedianApyChart,
	IProtocolTokenBreakdownChart,
	IProtocolValueChart,
	ProtocolTreasuryKey,
	ProtocolTvlKey
} from './api.types'
import {
	buildProtocolValueChartApiUrl,
	buildProtocolValueChartQueryKey,
	canonicalizeTokensToExclude,
	type CanonicalTokenExclusions,
	type ProtocolValueChartRequest,
	type ProtocolValueChartQueryKey
} from './valueChartSources'

interface IProtocolChartParamsBase {
	protocol: string | null
	enabled?: boolean
}

type IProtocolValueChartParams = IProtocolChartParamsBase & {
	key?: ProtocolTvlKey
	tokensToExclude?: string[]
}

type IProtocolAnyBreakdownChart = IProtocolChainBreakdownChart | IProtocolTokenBreakdownChart
type IProtocolChartQueryData = IProtocolValueChart | IProtocolAnyBreakdownChart

const buildProtocolChartApiUrl = (params: Record<string, string | undefined>) => {
	const searchParams = new URLSearchParams()
	for (const [key, value] of Object.entries(params)) {
		if (value != null) searchParams.set(key, value)
	}
	return `/api/public/protocols/charts?${searchParams.toString()}`
}

const getProtocolChartQueryOptions = <TChart extends IProtocolChartQueryData>(
	request: ProtocolValueChartRequest<string | null>,
	enabled = true
): UseQueryOptions<TChart, Error, TChart, ProtocolValueChartQueryKey> => {
	return {
		queryKey: buildProtocolValueChartQueryKey(request),
		queryFn: async () => {
			const protocol = request.protocol
			if (protocol === null || protocol.trim() === '') throw new Error('Protocol is required')
			return fetchJson<TChart>(buildProtocolValueChartApiUrl({ ...request, protocol }))
		},
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: request.protocol !== null && request.protocol.trim() !== '' && enabled
	}
}

const normalizeActivityChart = (values: IProtocolValueChart): IProtocolValueChart =>
	values.map(([date, value]) => [date * 1e3, value])

export const useFetchProtocolActivityChart = ({
	queryKey,
	protocol,
	adapterType,
	dataType
}: {
	queryKey: string
	protocol: string | null
	adapterType: 'active-users' | 'new-users'
	dataType?: 'dailyTransactionsCount' | 'dailyGasUsed'
}) =>
	useQuery({
		queryKey: ['protocol-overview', queryKey, protocol],
		queryFn: async () => {
			if (protocol === null) throw new Error('Protocol is required')
			return fetchJson<IProtocolValueChart>(
				buildProtocolChartApiUrl({ kind: 'adapter', adapterType, protocol, ...(dataType ? { dataType } : {}) })
			).then(normalizeActivityChart)
		},
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: protocol !== null && protocol.trim() !== ''
	})

export const useFetchProtocolMedianAPY = (protocolName: string | null) =>
	useQuery<IProtocolMedianApyChart>({
		queryKey: ['protocol-overview', 'median-apy', protocolName],
		queryFn: async () => {
			if (protocolName === null) throw new Error('Protocol is required')
			return fetchJson<IProtocolMedianApyChart>(
				buildProtocolChartApiUrl({ kind: 'median-apy', protocol: protocolName })
			)
		},
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: protocolName !== null && protocolName.trim() !== ''
	})

export function useFetchProtocolTVLChart(params: IProtocolValueChartParams): UseQueryResult<IProtocolValueChart> {
	const tokenExclusions = canonicalizeTokensToExclude(params.tokensToExclude)
	const request: ProtocolValueChartRequest<string | null> = {
		source: 'tvl',
		protocol: params.protocol,
		...(params.key !== undefined ? { key: params.key } : {}),
		...(tokenExclusions ? { tokenExclusions } : {})
	}
	return useQuery(getProtocolChartQueryOptions<IProtocolValueChart>(request, params.enabled))
}

interface IFetchProtocolChartsByKeysCommonParams {
	protocol: string | null
	includeBase?: boolean
	inflows?: boolean
	chainBreakdown?: boolean
}

export type IFetchProtocolChartsByKeysParams = IFetchProtocolChartsByKeysCommonParams &
	(
		| { source?: 'tvl'; keys: ProtocolTvlKey[]; tokensToExclude?: string[] }
		| { source: 'treasury'; keys: ProtocolTreasuryKey[]; tokensToExclude?: never }
	)

interface IFetchProtocolChartsByKeysResult {
	keysToFetch: Array<ProtocolTvlKey | ProtocolTreasuryKey | undefined>
	tvlChartQueries: Array<UseQueryResult<IProtocolValueChart>>
	chainBreakdownChartQueries: Array<UseQueryResult<IProtocolChainBreakdownChart>>
	tokenBreakdownUsdQueries: Array<UseQueryResult<IProtocolTokenBreakdownChart>>
	tokenBreakdownRawQueries: Array<UseQueryResult<IProtocolTokenBreakdownChart>>
}

type ProtocolChartRequestGroups = {
	value: Array<ProtocolValueChartRequest<string | null>>
	chainBreakdown: Array<ProtocolValueChartRequest<string | null>>
	tokenBreakdownUsd: Array<ProtocolValueChartRequest<string | null>>
	tokenBreakdownRaw: Array<ProtocolValueChartRequest<string | null>>
}

type ProtocolTvlRequestBase = {
	source: 'tvl'
	protocol: string | null
	key?: ProtocolTvlKey
	tokenExclusions?: CanonicalTokenExclusions
}

type ProtocolTreasuryRequestBase = {
	source: 'treasury'
	protocol: string | null
	key?: ProtocolTreasuryKey
}

const buildTvlRequestGroups = ({
	keys,
	protocol,
	tokenExclusions,
	chainBreakdown,
	inflows
}: {
	keys: Array<ProtocolTvlKey | undefined>
	protocol: string | null
	tokenExclusions: ReturnType<typeof canonicalizeTokensToExclude>
	chainBreakdown: boolean
	inflows: boolean
}): ProtocolChartRequestGroups => {
	const common = (key: ProtocolTvlKey | undefined): ProtocolTvlRequestBase => ({
		source: 'tvl',
		protocol,
		...(key !== undefined ? { key } : {}),
		...(tokenExclusions ? { tokenExclusions } : {})
	})
	return {
		value: keys.map(common),
		chainBreakdown: chainBreakdown ? keys.map((key) => ({ ...common(key), breakdownType: 'chain-breakdown' })) : [],
		tokenBreakdownUsd: inflows ? keys.map((key) => ({ ...common(key), breakdownType: 'token-breakdown' })) : [],
		tokenBreakdownRaw: inflows
			? keys.map((key) => ({ ...common(key), breakdownType: 'token-breakdown', currency: 'token' }))
			: []
	}
}

const buildTreasuryRequestGroups = ({
	keys,
	protocol,
	chainBreakdown,
	inflows
}: {
	keys: Array<ProtocolTreasuryKey | undefined>
	protocol: string | null
	chainBreakdown: boolean
	inflows: boolean
}): ProtocolChartRequestGroups => {
	const common = (key: ProtocolTreasuryKey | undefined): ProtocolTreasuryRequestBase => ({
		source: 'treasury',
		protocol,
		...(key !== undefined ? { key } : {})
	})
	return {
		value: keys.map(common),
		chainBreakdown: chainBreakdown ? keys.map((key) => ({ ...common(key), breakdownType: 'chain-breakdown' })) : [],
		tokenBreakdownUsd: inflows ? keys.map((key) => ({ ...common(key), breakdownType: 'token-breakdown' })) : [],
		tokenBreakdownRaw: inflows
			? keys.map((key) => ({ ...common(key), breakdownType: 'token-breakdown', currency: 'token' }))
			: []
	}
}

export function useFetchProtocolChartsByKeys(
	params: IFetchProtocolChartsByKeysParams
): IFetchProtocolChartsByKeysResult {
	const { protocol, includeBase = true, inflows = true, chainBreakdown = true } = params
	const tvlKeysToFetch = useMemo<Array<ProtocolTvlKey | undefined>>(() => {
		if (params.source === 'treasury') return []
		const base: Array<ProtocolTvlKey | undefined> = includeBase ? [undefined] : []
		return Array.from(new Set([...base, ...params.keys]))
	}, [includeBase, params.keys, params.source])
	const treasuryKeysToFetch = useMemo<Array<ProtocolTreasuryKey | undefined>>(() => {
		if (params.source !== 'treasury') return []
		const base: Array<ProtocolTreasuryKey | undefined> = includeBase ? [undefined] : []
		return Array.from(new Set([...base, ...params.keys]))
	}, [includeBase, params.keys, params.source])
	const keysToFetch: Array<ProtocolTvlKey | ProtocolTreasuryKey | undefined> =
		params.source === 'treasury' ? treasuryKeysToFetch : tvlKeysToFetch
	const requests =
		params.source === 'treasury'
			? buildTreasuryRequestGroups({ keys: treasuryKeysToFetch, protocol, chainBreakdown, inflows })
			: buildTvlRequestGroups({
					keys: tvlKeysToFetch,
					protocol,
					tokenExclusions: canonicalizeTokensToExclude(params.tokensToExclude),
					chainBreakdown,
					inflows
				})

	const tvlChartQueries = useQueries({
		queries: requests.value.map((request) => getProtocolChartQueryOptions<IProtocolValueChart>(request))
	})
	const chainBreakdownChartQueries = useQueries({
		queries: requests.chainBreakdown.map((request) =>
			getProtocolChartQueryOptions<IProtocolChainBreakdownChart>(request)
		)
	})
	const tokenBreakdownUsdQueries = useQueries({
		queries: requests.tokenBreakdownUsd.map((request) =>
			getProtocolChartQueryOptions<IProtocolTokenBreakdownChart>(request)
		)
	})
	const tokenBreakdownRawQueries = useQueries({
		queries: requests.tokenBreakdownRaw.map((request) =>
			getProtocolChartQueryOptions<IProtocolTokenBreakdownChart>(request)
		)
	})

	return {
		keysToFetch,
		tvlChartQueries,
		chainBreakdownChartQueries,
		tokenBreakdownUsdQueries,
		tokenBreakdownRawQueries
	}
}
