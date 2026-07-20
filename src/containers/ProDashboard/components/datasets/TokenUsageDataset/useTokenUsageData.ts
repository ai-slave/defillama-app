import { useQuery } from '@tanstack/react-query'
import { useContext, useMemo } from 'react'
import { ProxyAuthTokenContext, StreamDoneContext } from '~/containers/ProDashboard/queries'
import { fetchTokenUsageViaProxy } from '~/containers/ProDashboard/services/fetchViaProxy'
import { getProTokenUsageQueryKey, normalizeProTokenSymbols } from '~/containers/ProDashboard/tableQueryKeys'
import { aggregateProtocolTokenUsage } from '~/containers/TokenUsage/aggregate'
import { fetchProtocolsByTokenClient } from '~/containers/TokenUsage/api'
import type { ProtocolTokenUsageData } from '~/containers/TokenUsage/api.types'

export type TokenUsageData = ProtocolTokenUsageData

export function useTokenUsageData(tokenSymbols: string[], includeCex: boolean = false) {
	const streamDone = useContext(StreamDoneContext)
	const authToken = useContext(ProxyAuthTokenContext)
	const normalizedTokenSymbols = useMemo(() => normalizeProTokenSymbols(tokenSymbols), [tokenSymbols])
	const query = useQuery<TokenUsageData[]>({
		queryKey: getProTokenUsageQueryKey(normalizedTokenSymbols, includeCex),
		queryFn: async () => {
			const promises = normalizedTokenSymbols.map(async (symbol) => {
				const data = authToken
					? await fetchTokenUsageViaProxy(symbol, authToken)
					: await fetchProtocolsByTokenClient(symbol)
				return { symbol, data }
			})

			return aggregateProtocolTokenUsage(await Promise.all(promises), includeCex)
		},
		enabled: streamDone && normalizedTokenSymbols.length > 0,
		staleTime: Infinity,
		retry: 1
	})
	return { ...query, isLoading: query.isLoading || !streamDone }
}
