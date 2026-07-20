import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { parseDashboardQueryKey } from '../dashboardQueryKey'
import type { DashboardStreamChunk } from '../dashboardStreamContract'
import type { Dashboard } from '../dashboardTypes'
import type { ProDashboardAppMetadata } from '../dataContracts'
import type { ProDashboardProtocolCatalog } from '../protocolCatalog'
import { getProRwaBreakdownQueryKey } from '../rwaBreakdown'
import type { TableServerData } from '../server/tableQueries'
import {
	getProEquitiesFilingsCacheKey,
	getProEquitiesStatementsCacheKey,
	getProLegacyTableChainQueryKey,
	getProRwaChainAssetsTableQueryKey,
	PRO_EQUITIES_COMPANIES_QUERY_KEY,
	PRO_RWA_ASSETS_TABLE_QUERY_KEY,
	PRO_RWA_CHAINS_TABLE_QUERY_KEY,
	PROTOCOLS_LIST_QUERY_KEY
} from '../tableQueryKeys'

export interface DashboardStreamState {
	isStreaming: boolean
	/** undefined = not received yet, null = received as null, Dashboard = received */
	dashboard: Dashboard | null | undefined
	protocolsAndChains: ProDashboardProtocolCatalog | null
	appMetadata: ProDashboardAppMetadata | null
	isDone: boolean
	error: string | null
}

function seedSerializedQueryData(
	queryClient: ReturnType<typeof useQueryClient>,
	serializedKey: string,
	data: unknown,
	now: number
) {
	const queryKey = parseDashboardQueryKey(serializedKey)
	if (queryKey) queryClient.setQueryData(queryKey, data, { updatedAt: now })
}

function seedTableDataIntoCache(
	queryClient: ReturnType<typeof useQueryClient>,
	tableData: TableServerData,
	now: number
) {
	if (tableData.protocolsList) {
		queryClient.setQueryData(PROTOCOLS_LIST_QUERY_KEY, tableData.protocolsList, { updatedAt: now })
	}
	for (const [chain, data] of Object.entries(tableData.volumeByChain)) {
		queryClient.setQueryData(getProLegacyTableChainQueryKey('volume', chain), data, { updatedAt: now })
	}
	for (const [chain, data] of Object.entries(tableData.feesByChain)) {
		queryClient.setQueryData(getProLegacyTableChainQueryKey('fees', chain), data, { updatedAt: now })
	}
	for (const [chain, data] of Object.entries(tableData.perpsByChain)) {
		queryClient.setQueryData(getProLegacyTableChainQueryKey('perps', chain), data, { updatedAt: now })
	}
	for (const [chain, data] of Object.entries(tableData.openInterestByChain)) {
		queryClient.setQueryData(getProLegacyTableChainQueryKey('open-interest', chain), data, { updatedAt: now })
	}
	for (const [keyJson, data] of Object.entries(tableData.datasetsByQueryKey)) {
		seedSerializedQueryData(queryClient, keyJson, data, now)
	}
	for (const [keyJson, data] of Object.entries(tableData.tokenUsageByQueryKey)) {
		seedSerializedQueryData(queryClient, keyJson, data, now)
	}
}

export function useDashboardStream(
	dashboardId: string | undefined,
	authToken?: string | null,
	enabled = true
): DashboardStreamState {
	const queryClient = useQueryClient()
	const [state, setState] = useState<DashboardStreamState>({
		isStreaming: false,
		dashboard: undefined,
		protocolsAndChains: null,
		appMetadata: null,
		isDone: !dashboardId || dashboardId === 'new',
		error: null
	})
	const abortRef = useRef<AbortController | null>(null)
	const authTokenRef = useRef(authToken)
	authTokenRef.current = authToken

	const handleLine = useCallback(
		(line: string) => {
			if (!line.trim()) return

			try {
				const chunk = JSON.parse(line) as DashboardStreamChunk
				const now = Date.now()

				switch (chunk.type) {
					case 'dashboard':
						// Dashboard is seeded into cache by the provider (needs auth-aware key)
						setState((s) => ({ ...s, dashboard: chunk.data ?? null }))
						break

					case 'protocolsAndChains':
						setState((s) => ({ ...s, protocolsAndChains: chunk.data }))
						if (chunk.data) {
							queryClient.setQueryData(['pro-dashboard', 'protocols-and-chains'], chunk.data, {
								updatedAt: now
							})
						}
						break

					case 'appMetadata':
						setState((s) => ({ ...s, appMetadata: chunk.data }))
						if (chunk.data) {
							queryClient.setQueryData(['pro-dashboard', 'app-metadata'], chunk.data, { updatedAt: now })
						}
						break

					case 'chartData':
						queryClient.setQueryData(chunk.queryKey, chunk.data, { updatedAt: now })
						break

					case 'tableData':
						if (chunk.data) {
							seedTableDataIntoCache(queryClient, chunk.data, now)
						}
						break

					case 'yieldsChartData':
						if (chunk.data) {
							if ('supply' in chunk.data) {
								queryClient.setQueryData(['yield-supply-history', chunk.id], chunk.data.supply ?? null, {
									updatedAt: now
								})
							}
							if ('borrow' in chunk.data) {
								queryClient.setQueryData(['yield-borrow-history', chunk.id], chunk.data.borrow ?? null, {
									updatedAt: now
								})
							}
						}
						break

					case 'protocolTvlChartData':
						queryClient.setQueryData(chunk.queryKey, chunk.data, { updatedAt: now })
						break

					case 'unifiedTableData':
						seedSerializedQueryData(queryClient, chunk.key, chunk.data, now)
						break

					case 'stablecoinsChartData':
						if (chunk.data) {
							queryClient.setQueryData(['pro-dashboard', 'stablecoins-chart-data', chunk.chain], chunk.data, {
								updatedAt: now
							})
						}
						break

					case 'rwaBreakdownData':
						if (chunk.data) {
							queryClient.setQueryData(
								getProRwaBreakdownQueryKey(chunk.breakdown, chunk.metric, chunk.chain),
								chunk.data,
								{ updatedAt: now }
							)
						}
						break

					case 'rwaAssetChartData':
						if (chunk.data && chunk.id) {
							queryClient.setQueryData(['pro-dashboard', 'rwa-asset-chart', chunk.id], chunk.data, {
								updatedAt: now
							})
						}
						break

					case 'rwaAssetsTableData':
						if (chunk.data) {
							queryClient.setQueryData(PRO_RWA_ASSETS_TABLE_QUERY_KEY, chunk.data, {
								updatedAt: now
							})
						}
						break

					case 'rwaChainsTableData':
						if (chunk.data) {
							queryClient.setQueryData(PRO_RWA_CHAINS_TABLE_QUERY_KEY, chunk.data, {
								updatedAt: now
							})
						}
						break

					case 'rwaChainAssetsTableData':
						if (chunk.data && chunk.chain) {
							queryClient.setQueryData(getProRwaChainAssetsTableQueryKey(chunk.chain), chunk.data, {
								updatedAt: now
							})
						}
						break

					case 'equitiesCompaniesData':
						if (chunk.data) {
							queryClient.setQueryData(PRO_EQUITIES_COMPANIES_QUERY_KEY, chunk.data, {
								updatedAt: now
							})
						}
						break

					case 'equitiesStatementsData':
						if (chunk.data && chunk.ticker) {
							queryClient.setQueryData(getProEquitiesStatementsCacheKey(chunk.ticker), chunk.data, {
								updatedAt: now
							})
						}
						break

					case 'equitiesFilingsData':
						if (chunk.data && chunk.ticker) {
							queryClient.setQueryData(getProEquitiesFilingsCacheKey(chunk.ticker), chunk.data, {
								updatedAt: now
							})
						}
						break

					case 'emissionData':
						seedSerializedQueryData(queryClient, chunk.key, chunk.data, now)
						break

					case 'dimensionDatasetData':
					case 'incomeStatementData':
					case 'chartBuilderData':
					case 'cexAnalyticsData':
					case 'chainsDatasetData':
					case 'yieldsDatasetData':
					case 'stablecoinsTableData':
					case 'stablecoinAssetData':
						seedSerializedQueryData(queryClient, chunk.key, chunk.data, now)
						break

					case 'done':
						setState((s) => ({ ...s, isStreaming: false, isDone: true }))
						break
				}
			} catch {
				// Ignore malformed lines
			}
		},
		[queryClient]
	)

	useEffect(() => {
		if (!dashboardId || dashboardId === 'new' || !enabled) return

		// Abort any previous stream before starting a new one
		abortRef.current?.abort()

		const abortController = new AbortController()
		abortRef.current = abortController

		setState({
			isStreaming: true,
			dashboard: undefined,
			protocolsAndChains: null,
			appMetadata: null,
			isDone: false,
			error: null
		})

		const startStream = async () => {
			try {
				const tokenAtFetch = authTokenRef.current
				const streamUrl = tokenAtFetch
					? `/api/dynamic/pro-dashboard/${dashboardId}/stream?_=${Date.now()}`
					: `/api/dynamic/pro-dashboard/${dashboardId}/stream`
				const response = await fetch(streamUrl, {
					credentials: 'include',
					headers: tokenAtFetch ? { Authorization: `Bearer ${tokenAtFetch}` } : undefined,
					signal: abortController.signal
				})

				if (!response.ok || !response.body) {
					setState((s) => ({
						...s,
						isStreaming: false,
						isDone: true,
						error: `Stream failed: ${response.status}`
					}))
					return
				}

				const reader = response.body.getReader()
				const decoder = new TextDecoder()
				let lineBuffer = ''

				try {
					while (true) {
						if (abortController.signal.aborted) break

						const { done, value } = await reader.read()

						if (done) {
							// Flush remaining buffer
							if (lineBuffer.trim()) {
								handleLine(lineBuffer.trim())
							}
							break
						}

						const chunk = decoder.decode(value, { stream: true })
						lineBuffer += chunk

						const lines = lineBuffer.split('\n')

						if (lines.length > 0 && !chunk.endsWith('\n')) {
							lineBuffer = lines.pop() || ''
						} else {
							lineBuffer = ''
						}

						for (const line of lines) {
							handleLine(line)
						}
					}
				} finally {
					try {
						reader.releaseLock()
					} catch {}
				}

				setState((s) => (s.isDone ? s : { ...s, isStreaming: false, isDone: true }))
			} catch (err) {
				if (abortController.signal.aborted) return
				setState((s) => ({
					...s,
					isStreaming: false,
					isDone: true,
					error: err instanceof Error ? err.message : 'Stream failed'
				}))
			}
		}

		startStream()

		return () => {
			abortController.abort()
		}
	}, [dashboardId, enabled, handleLine])

	return state
}
