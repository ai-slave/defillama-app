import { useQueries, useQuery } from '@tanstack/react-query'
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query'
import { useMemo } from 'react'
import { fetchJson } from '~/utils/async'
import type {
	IProtocolChainBreakdownChart,
	IProtocolChartV2Params,
	IProtocolTokenBreakdownChart,
	IProtocolValueChart
} from './api.types'
import {
	buildProtocolValueChartApiUrl,
	buildProtocolValueChartQueryKey,
	type ProtocolValueChartQueryKey,
	type ProtocolValueChartSource
} from './valueChartSources'

interface IProtocolChartParams extends Omit<IProtocolChartV2Params, 'protocol'> {
	protocol: string | null
	enabled?: boolean
}

interface IProtocolValueChartParams extends Omit<IProtocolChartParams, 'breakdownType'> {
	breakdownType?: undefined
}

interface IProtocolBreakdownChartParams extends Omit<IProtocolChartParams, 'breakdownType'> {
	breakdownType: NonNullable<IProtocolChartV2Params['breakdownType']>
}

type IProtocolAnyBreakdownChart = IProtocolChainBreakdownChart | IProtocolTokenBreakdownChart
type IProtocolChartQueryData = IProtocolValueChart | IProtocolAnyBreakdownChart | null
type IActivityChart = Array<[number, number]> | null

const buildProtocolChartApiUrl = (params: Record<string, string | undefined>) => {
	const searchParams = new URLSearchParams()
	for (const [key, value] of Object.entries(params)) {
		if (value != null) {
			searchParams.set(key, value)
		}
	}
	return `/api/public/protocols/charts?${searchParams.toString()}`
}

const getProtocolChartQueryOptions = ({
	source,
	protocol,
	key,
	currency,
	breakdownType,
	tokensToExclude,
	enabled = true
}: IProtocolChartParams & { source: ProtocolValueChartSource }): UseQueryOptions<
	IProtocolChartQueryData,
	Error,
	IProtocolChartQueryData,
	ProtocolValueChartQueryKey
> => {
	const isEnabled = !!protocol && enabled
	return {
		queryKey: buildProtocolValueChartQueryKey({ source, protocol, key, currency, breakdownType, tokensToExclude }),
		queryFn: () =>
			fetchJson<IProtocolChartQueryData>(
				buildProtocolValueChartApiUrl({
					source,
					protocol: protocol!,
					key,
					currency,
					breakdownType,
					tokensToExclude
				})
			),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: isEnabled
	}
}

const getProtocolTvlChartQueryOptions = (params: IProtocolChartParams) =>
	getProtocolChartQueryOptions({ ...params, source: 'tvl' as const })

const getProtocolTreasuryChartQueryOptions = (params: IProtocolChartParams) =>
	getProtocolChartQueryOptions({ ...params, source: 'treasury' as const })

const normalizeActivityChart = (values: Array<[number, number]> | null): IActivityChart => {
	if (!values || values.length === 0) return null

	const normalized: Array<[number, number]> = []
	for (const [date, val] of values) {
		normalized.push([date * 1e3, +val])
	}
	return normalized
}

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
}) => {
	const isEnabled = !!protocol
	return useQuery({
		queryKey: ['protocol-overview', queryKey, protocol],
		queryFn: () =>
			fetchJson<Array<[number, number]>>(
				buildProtocolChartApiUrl({
					kind: 'adapter',
					adapterType,
					protocol: protocol!,
					dataType
				})
			)
				.then((values) => normalizeActivityChart(values))
				.catch(() => null),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: isEnabled
	})
}
export const useFetchProtocolMedianAPY = (protocolName: string | null) => {
	const isEnabled = !!protocolName
	return useQuery({
		queryKey: ['protocol-overview', 'median-apy', protocolName],
		queryFn: () =>
			fetchJson(buildProtocolChartApiUrl({ kind: 'median-apy', protocol: protocolName! })).catch(() => null),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: isEnabled
	})
}

export function useFetchProtocolTVLChart(
	params: IProtocolBreakdownChartParams
): UseQueryResult<IProtocolAnyBreakdownChart | null>
export function useFetchProtocolTVLChart(params: IProtocolValueChartParams): UseQueryResult<IProtocolValueChart | null>
export function useFetchProtocolTVLChart({
	protocol,
	key,
	currency,
	breakdownType,
	tokensToExclude,
	enabled = true
}: IProtocolChartParams): UseQueryResult<IProtocolValueChart | IProtocolAnyBreakdownChart | null> {
	return useQuery<IProtocolChartQueryData, Error, IProtocolChartQueryData, ProtocolValueChartQueryKey>(
		getProtocolTvlChartQueryOptions({ protocol, key, currency, breakdownType, tokensToExclude, enabled })
	)
}

interface IFetchProtocolChartsByKeysParams {
	protocol: string | null
	keys: string[]
	includeBase?: boolean
	source: ProtocolValueChartSource
	inflows?: boolean
	chainBreakdown?: boolean
	tokensToExclude?: string[]
}

interface IFetchProtocolChartsByKeysResult {
	keysToFetch: Array<string | undefined>
	tvlChartQueries: Array<UseQueryResult<IProtocolValueChart | null>>
	chainBreakdownChartQueries: Array<UseQueryResult<IProtocolChainBreakdownChart | null>>
	tokenBreakdownUsdQueries: Array<UseQueryResult<IProtocolTokenBreakdownChart | null>>
	tokenBreakdownRawQueries: Array<UseQueryResult<IProtocolTokenBreakdownChart | null>>
}

export function useFetchProtocolChartsByKeys({
	protocol,
	keys,
	includeBase = true,
	source,
	inflows = true,
	chainBreakdown = true,
	tokensToExclude
}: IFetchProtocolChartsByKeysParams): IFetchProtocolChartsByKeysResult {
	const keysToFetch = useMemo(() => {
		const base: Array<string | undefined> = includeBase ? [undefined] : []
		return Array.from(new Set([...base, ...keys]))
	}, [includeBase, keys])

	const getQueryOptions = source === 'tvl' ? getProtocolTvlChartQueryOptions : getProtocolTreasuryChartQueryOptions

	const tvlChartQueries = useQueries({
		queries: keysToFetch.map((key) => getQueryOptions({ protocol, key, tokensToExclude }))
	}) as Array<UseQueryResult<IProtocolValueChart | null>>

	const chainBreakdownChartQueries = useQueries({
		queries: chainBreakdown
			? keysToFetch.map((key) => getQueryOptions({ protocol, key, breakdownType: 'chain-breakdown', tokensToExclude }))
			: []
	}) as Array<UseQueryResult<IProtocolChainBreakdownChart | null>>

	const tokenBreakdownUsdQueries = useQueries({
		queries: inflows
			? keysToFetch.map((key) => getQueryOptions({ protocol, key, breakdownType: 'token-breakdown', tokensToExclude }))
			: []
	}) as Array<UseQueryResult<IProtocolTokenBreakdownChart | null>>

	const tokenBreakdownRawQueries = useQueries({
		queries: inflows
			? keysToFetch.map((key) =>
					getQueryOptions({ protocol, key, breakdownType: 'token-breakdown', currency: 'token', tokensToExclude })
				)
			: []
	}) as Array<UseQueryResult<IProtocolTokenBreakdownChart | null>>

	return {
		keysToFetch,
		tvlChartQueries,
		chainBreakdownChartQueries,
		tokenBreakdownUsdQueries,
		tokenBreakdownRawQueries
	}
}
