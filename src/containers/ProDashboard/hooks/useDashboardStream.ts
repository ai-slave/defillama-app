import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { createDashboardStreamLineParser } from '~/containers/ProDashboard/dashboardStreamLines'
import { getYieldBorrowHistoryQueryKey, getYieldSupplyHistoryQueryKey } from '~/containers/Yields/queries.client'
import { parseDashboardQueryKey } from '../dashboardQueryKey'
import type { DashboardStreamChunk } from '../dashboardStreamContract'
import type { Dashboard } from '../dashboardTypes'
import { VARIABLE_QUERY_PREFIX } from '../dashboardVariables/resolve'
import { getProRwaBreakdownQueryKey } from '../rwaBreakdown'
import {
	getProEquitiesFilingsCacheKey,
	getProEquitiesStatementsCacheKey,
	PRO_EQUITIES_COMPANIES_QUERY_KEY,
	PRO_RWA_ASSETS_TABLE_QUERY_KEY,
	PRO_RWA_CHAINS_TABLE_QUERY_KEY
} from '../tableQueryKeys'
import { wasDashboardDeleted } from './useDashboardAPI'

export interface DashboardStreamState {
	isStreaming: boolean
	/** undefined = not received yet, null = received as null, Dashboard = received */
	dashboard: Dashboard | null | undefined
	isDone: boolean
	readyItemIds: ReadonlySet<string>
	error: string | null
}

const NO_READY_ITEMS: ReadonlySet<string> = new Set()

function seedSerializedQueryData<T>(
	queryClient: ReturnType<typeof useQueryClient>,
	serializedKey: string,
	data: T,
	now: number
) {
	const queryKey = parseDashboardQueryKey(serializedKey)
	if (queryKey) queryClient.setQueryData(queryKey, data, { updatedAt: now })
}

// Owns the try/finally: the compiler cannot lower a try without a catch, and a plain module function
// is never compiled. The reader is released on every path, including a mid-stream throw.
async function pumpStream(
	reader: ReadableStreamDefaultReader<Uint8Array>,
	decoder: TextDecoder,
	lineParser: { push: (chunk: string) => void; finish: () => void },
	signal: AbortSignal
) {
	try {
		while (true) {
			if (signal.aborted) break
			const { done, value } = await reader.read()
			if (done) {
				lineParser.push(decoder.decode())
				lineParser.finish()
				break
			}
			lineParser.push(decoder.decode(value, { stream: true }))
		}
	} finally {
		try {
			reader.releaseLock()
		} catch {
			// The lock is already released once the stream has errored.
		}
	}
}

export interface DashboardStreamRequestOptions {
	variableOverrides?: Readonly<Record<string, string>>
	itemId?: string
	version?: string
}

export function buildStreamRequest(
	dashboardId: string,
	authToken: string | null | undefined,
	signal: AbortSignal,
	options: DashboardStreamRequestOptions = {}
) {
	const params = new URLSearchParams()
	if (authToken) params.set('_', String(Date.now()))
	else if (options.version) params.set('v', options.version)
	if (options.itemId) params.set('item', options.itemId)
	for (const id of Object.keys(options.variableOverrides ?? {}).sort()) {
		params.set(`${VARIABLE_QUERY_PREFIX}${id}`, options.variableOverrides![id] as string)
	}
	const query = params.toString()
	const url = `/api/dynamic/pro-dashboard/${dashboardId}/stream${query ? `?${query}` : ''}`
	const init: RequestInit = { credentials: 'include', signal }
	if (authToken) init.headers = { Authorization: `Bearer ${authToken}` }
	return { url, init }
}

// Returns the body only when the response is actually streamable, so the caller's check is not a
// logical value block inside its try.
function usableStreamBody(response: Response) {
	return response.ok ? response.body : null
}

/** Who the stream reads as. The dashboard query key is scoped by the same fields. */
export interface DashboardStreamViewer {
	authToken: string | null
	isAuthenticated: boolean
	userId: string | undefined
}

export function useDashboardStream(
	dashboardId: string | undefined,
	viewer: DashboardStreamViewer,
	enabled = true,
	options: DashboardStreamRequestOptions = {}
): DashboardStreamState {
	const { authToken, isAuthenticated, userId } = viewer
	const queryClient = useQueryClient()
	const [state, setState] = useState<DashboardStreamState>({
		isStreaming: false,
		dashboard: undefined,
		isDone: !dashboardId || dashboardId === 'new',
		readyItemIds: NO_READY_ITEMS,
		error: null
	})
	const handleLine = useCallback(
		(line: string) => {
			if (!line.trim()) return

			let chunk: DashboardStreamChunk
			try {
				chunk = JSON.parse(line)
			} catch {
				return
			}

			const now = Date.now()
			switch (chunk.type) {
				case 'dashboard':
					if (chunk.data && dashboardId && !wasDashboardDeleted(queryClient, chunk.data.id, userId)) {
						queryClient.setQueryData(['pro-dashboard', 'dashboard', dashboardId, isAuthenticated, userId], chunk.data, {
							updatedAt: now
						})
						// Slug routes and mutation scopes must share the same confirmed snapshot by dashboard id.
						if (chunk.data.id !== dashboardId) {
							queryClient.setQueryData(
								['pro-dashboard', 'dashboard', chunk.data.id, isAuthenticated, userId],
								chunk.data,
								{
									updatedAt: now
								}
							)
						}
					}
					setState((previousState) => ({
						...previousState,
						dashboard: chunk.data
					}))
					break
				case 'protocolsAndChains':
					if (chunk.data) {
						queryClient.setQueryData(['pro-dashboard', 'protocols-and-chains'], chunk.data, { updatedAt: now })
					}
					break
				case 'appMetadata':
					if (chunk.data) queryClient.setQueryData(['pro-dashboard', 'app-metadata'], chunk.data, { updatedAt: now })
					break
				case 'chartData':
				case 'protocolTvlChartData':
					queryClient.setQueryData(chunk.queryKey, chunk.data, {
						updatedAt: now
					})
					break
				case 'tokenUsageData':
				case 'emissionData':
				case 'incomeStatementData':
				case 'chartBuilderData':
				case 'cexAnalyticsData':
				case 'chainsDatasetData':
				case 'yieldsDatasetData':
				case 'stablecoinsTableData':
				case 'stablecoinAssetData':
					seedSerializedQueryData(queryClient, chunk.key, chunk.data, now)
					break
				case 'unifiedTableData':
					seedSerializedQueryData(queryClient, chunk.key, chunk.data, now)
					break
				case 'yieldsChartData':
					if ('supply' in chunk.data) {
						queryClient.setQueryData(getYieldSupplyHistoryQueryKey(chunk.id), chunk.data.supply ?? null, {
							updatedAt: now
						})
					}
					if ('borrow' in chunk.data) {
						queryClient.setQueryData(getYieldBorrowHistoryQueryKey(chunk.id), chunk.data.borrow ?? null, {
							updatedAt: now
						})
					}
					break
				case 'stablecoinsChartData':
					queryClient.setQueryData(['pro-dashboard', 'stablecoins-chart-data', chunk.chain], chunk.data, {
						updatedAt: now
					})
					break
				case 'rwaBreakdownData':
					queryClient.setQueryData(getProRwaBreakdownQueryKey(chunk.breakdown, chunk.metric, chunk.chain), chunk.data, {
						updatedAt: now
					})
					break
				case 'rwaAssetChartData':
					queryClient.setQueryData(['pro-dashboard', 'rwa-asset-chart', chunk.id], chunk.data, { updatedAt: now })
					break
				case 'rwaAssetsTableData':
					queryClient.setQueryData(PRO_RWA_ASSETS_TABLE_QUERY_KEY, chunk.data, {
						updatedAt: now
					})
					break
				case 'rwaChainsTableData':
					queryClient.setQueryData(PRO_RWA_CHAINS_TABLE_QUERY_KEY, chunk.data, {
						updatedAt: now
					})
					break
				case 'equitiesCompaniesData':
					queryClient.setQueryData(PRO_EQUITIES_COMPANIES_QUERY_KEY, chunk.data, { updatedAt: now })
					break
				case 'equitiesStatementsData':
					queryClient.setQueryData(getProEquitiesStatementsCacheKey(chunk.ticker), chunk.data, { updatedAt: now })
					break
				case 'equitiesFilingsData':
					queryClient.setQueryData(getProEquitiesFilingsCacheKey(chunk.ticker), chunk.data, { updatedAt: now })
					break
				case 'itemReady':
					setState((previousState) => {
						const readyItemIds = new Set(previousState.readyItemIds)
						for (const id of chunk.itemIds) readyItemIds.add(id)
						return { ...previousState, readyItemIds }
					})
					break
				case 'done':
					setState((previousState) => ({
						...previousState,
						isStreaming: false,
						isDone: true
					}))
					break
			}
		},
		[queryClient, dashboardId, isAuthenticated, userId]
	)

	// A new stream target (dashboard, token or enabled flag) starts a fresh streaming state in the same render
	// that starts the stream, instead of one commit later.
	const overridesKey = JSON.stringify(options.variableOverrides ?? {})
	const itemKey = options.itemId ?? ''
	const versionKey = options.version ?? ''
	const streamKey =
		dashboardId && dashboardId !== 'new' && enabled
			? `${dashboardId}|${authToken ?? ''}|${isAuthenticated}|${userId ?? ''}|${overridesKey}|${itemKey}|${versionKey}`
			: null
	const [syncedStreamKey, setSyncedStreamKey] = useState<string | null>(null)
	if (streamKey !== syncedStreamKey) {
		setSyncedStreamKey(streamKey)
		if (streamKey) {
			setState({ isStreaming: true, dashboard: undefined, isDone: false, readyItemIds: NO_READY_ITEMS, error: null })
		}
	}

	useEffect(() => {
		if (!dashboardId || dashboardId === 'new' || !enabled) return

		const abortController = new AbortController()

		const requestOptions: DashboardStreamRequestOptions = {
			...(overridesKey === '{}' ? {} : { variableOverrides: JSON.parse(overridesKey) as Record<string, string> }),
			...(itemKey ? { itemId: itemKey } : {}),
			...(versionKey ? { version: versionKey } : {})
		}
		const startStream = async () => {
			// Built before the try: its conditionals are value blocks, and assembling a request cannot fail.
			const request = buildStreamRequest(dashboardId, authToken, abortController.signal, requestOptions)
			try {
				const response = await fetch(request.url, request.init)
				if (abortController.signal.aborted) return

				const body = usableStreamBody(response)
				if (!body) {
					setState((s) => ({
						...s,
						isStreaming: false,
						isDone: true,
						error: `Stream failed: ${response.status}`
					}))
					return
				}

				const reader = body.getReader()
				const decoder = new TextDecoder()
				const lineParser = createDashboardStreamLineParser((line) => {
					if (!abortController.signal.aborted) handleLine(line)
				})

				await pumpStream(reader, decoder, lineParser, abortController.signal)

				if (!abortController.signal.aborted) {
					setState((s) => (s.isDone ? s : { ...s, isStreaming: false, isDone: true }))
				}
			} catch {
				if (abortController.signal.aborted) return
				// The error only marks the failure for the notice; a network error's own text is never shown.
				setState((s) => ({ ...s, isStreaming: false, isDone: true, error: 'Stream failed' }))
			}
		}

		startStream()

		return () => {
			abortController.abort()
		}
	}, [authToken, dashboardId, enabled, handleLine, overridesKey, itemKey, versionKey])

	return state
}
