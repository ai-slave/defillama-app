import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useEffectEvent, useRef } from 'react'
import { useAuthContext } from '~/auth'
import { getAuthStoreSnapshot } from '~/auth/authStore'
import { AUTH_SERVER } from '~/constants'
import {
	readAppStorage,
	readAppStorageRaw,
	subscribeToLocalStorage,
	THEME_SYNC_KEY,
	WATCHLIST_KEYS,
	type AppStorage,
	type WatchlistStore,
	writeAppStorage
} from '~/contexts/LocalStorage'
import { subscribeToStorageKey } from '~/contexts/localStorageStore'
import { handleSimpleFetchResponse } from '~/utils/async'
import { useDebouncedCallback } from './useDebounce'

export const USER_CONFIG_QUERY_KEY = ['user-config']
const SYNC_DEBOUNCE_MS = 2000
type UserConfig = Partial<AppStorage>

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

const normalizeWatchlistStore = (value: unknown): WatchlistStore | null => {
	if (!isRecord(value)) return null

	const normalized: WatchlistStore = {}
	let hasNormalizedPortfolios = false
	for (const [portfolio, protocols] of Object.entries(value)) {
		if (!isRecord(protocols)) continue
		const normalizedProtocols: Record<string, string> = {}
		for (const [slug, name] of Object.entries(protocols)) {
			if (typeof name === 'string') {
				normalizedProtocols[slug] = name
			}
		}
		let hasNormalizedProtocols = false
		for (const _protocol in normalizedProtocols) {
			hasNormalizedProtocols = true
			break
		}
		if (hasNormalizedProtocols) {
			normalized[portfolio] = normalizedProtocols
			hasNormalizedPortfolios = true
		}
	}

	return hasNormalizedPortfolios ? normalized : null
}

const mergeWatchlists = (local: WatchlistStore | null, remote: WatchlistStore | null): WatchlistStore | null => {
	if (!local && !remote) return null
	if (!local) return remote
	if (!remote) return local

	const merged: WatchlistStore = { ...remote }
	for (const [portfolio, protocols] of Object.entries(local)) {
		merged[portfolio] = { ...remote[portfolio], ...protocols }
	}

	return merged
}

const mergeSelectedPortfolio = (local: unknown, remote: unknown): string | undefined => {
	if (typeof local === 'string' && local.length > 0) return local
	if (typeof remote === 'string' && remote.length > 0) return remote
	return undefined
}

export function useUserConfig() {
	const { isAuthenticated, authorizedFetch, user } = useAuthContext()
	const queryClient = useQueryClient()
	const hasInitializedRef = useRef(false)
	const lastSyncedRawRef = useRef<string | null>(null)

	const saveUserConfig = useMutation({
		scope: { id: 'user-config' },
		mutationFn: async ({ config, userId }: { config: UserConfig; userId: string }) => {
			if (getAuthStoreSnapshot().record?.id !== userId) throw new Error('Settings account changed')
			const response = await authorizedFetch(`${AUTH_SERVER}/user/config`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(config)
			})
			if (!response) throw new Error('Not authenticated')
			await handleSimpleFetchResponse(response)
			return config
		},
		onSuccess: (savedConfig, { userId }) => {
			queryClient.setQueryData([...USER_CONFIG_QUERY_KEY, userId], savedConfig)
			if (getAuthStoreSnapshot().record?.id === userId) lastSyncedRawRef.current = JSON.stringify(savedConfig)
		},
		onError: (error) => {
			console.error('Failed to sync settings:', error)
		}
	})

	const syncSettings = useDebouncedCallback(() => {
		const currentSettings = readAppStorageRaw()
		if (!user || !currentSettings) return
		// A pending edit can overwrite the last saved value, so undoing it must queue another save.
		const latestSettings = saveUserConfig.isPending
			? JSON.stringify(saveUserConfig.variables?.config)
			: lastSyncedRawRef.current
		if (currentSettings === latestSettings) return
		saveUserConfig.mutate({ config: readAppStorage(), userId: user.id })
	}, SYNC_DEBOUNCE_MS)

	const fetchConfig = useCallback(
		async (signal: AbortSignal): Promise<UserConfig | null> => {
			if (!isAuthenticated || !authorizedFetch) return null
			const processResponse = async (): Promise<UserConfig | null> => {
				const response = await authorizedFetch(`${AUTH_SERVER}/user/config`, { signal })
				if (response == null || signal.aborted) {
					return null
				}
				if (response.ok) {
					const config: UserConfig = await response.json()
					if (signal.aborted) return null

					const hasConfig = isRecord(config) && Object.keys(config).length > 0
					if (hasConfig && !hasInitializedRef.current) {
						const localSettings = readAppStorage()
						const localSettingsRaw = readAppStorageRaw()
						const mergedSettings: AppStorage = { ...localSettings, ...config }

						const watchlistKeys = [
							WATCHLIST_KEYS.DEFI_WATCHLIST,
							WATCHLIST_KEYS.YIELDS_WATCHLIST,
							WATCHLIST_KEYS.CHAINS_WATCHLIST,
							WATCHLIST_KEYS.TOKENS_WATCHLIST
						] as const

						for (const key of watchlistKeys) {
							const merged = mergeWatchlists(
								normalizeWatchlistStore(localSettings[key]),
								normalizeWatchlistStore(config[key])
							)
							if (merged) {
								mergedSettings[key] = merged
							}
						}

						const selectedKeys = [
							WATCHLIST_KEYS.DEFI_SELECTED_PORTFOLIO,
							WATCHLIST_KEYS.YIELDS_SELECTED_PORTFOLIO,
							WATCHLIST_KEYS.CHAINS_SELECTED_PORTFOLIO,
							WATCHLIST_KEYS.TOKENS_SELECTED_PORTFOLIO
						] as const

						for (const key of selectedKeys) {
							const mergedSelected = mergeSelectedPortfolio(localSettings[key], config[key])
							if (mergedSelected) {
								mergedSettings[key] = mergedSelected
							}
						}

						const mergedRaw = JSON.stringify(mergedSettings)
						if (mergedRaw !== localSettingsRaw) {
							writeAppStorage(mergedSettings)
						}
						lastSyncedRawRef.current = JSON.stringify(config)
						hasInitializedRef.current = true
						syncSettings()
					} else if (!hasConfig) {
						lastSyncedRawRef.current = '{}'
						hasInitializedRef.current = true
						syncSettings()
					}

					return config as UserConfig
				}
				if (response.status === 404) {
					lastSyncedRawRef.current = '{}'
					hasInitializedRef.current = true
					syncSettings()
					return {}
				}

				return null
			}
			try {
				return await processResponse()
			} catch (error) {
				if (signal.aborted) return null
				console.error('Failed to fetch/process user config:', error)
				return null
			}
		},
		[isAuthenticated, authorizedFetch, syncSettings]
	)

	const {
		data: userConfig,
		isLoading: isLoadingConfig,
		isError: isErrorLoadingConfig,
		refetch: refetchConfig
	} = useQuery<UserConfig | null>({
		queryKey: [...USER_CONFIG_QUERY_KEY, user?.id],
		queryFn: ({ signal }) => fetchConfig(signal),
		refetchOnMount: 'always',
		enabled: isAuthenticated,
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: true
	})

	// useEffectEvent ensures we call the latest syncSettings without re-subscribing listeners
	const onStorageChange = useEffectEvent(() => {
		if (!hasInitializedRef.current) {
			return
		}
		syncSettings()
	})

	useEffect(() => {
		if (!isAuthenticated) {
			hasInitializedRef.current = false
			lastSyncedRawRef.current = null
			syncSettings.cancel()
			return
		}

		const unsubscribeLocalStorage = subscribeToLocalStorage(onStorageChange)
		const unsubscribeTheme = subscribeToStorageKey(THEME_SYNC_KEY, onStorageChange)

		return () => {
			unsubscribeLocalStorage()
			unsubscribeTheme()
			syncSettings.cancel()
		}
	}, [isAuthenticated, syncSettings])

	return {
		userConfig,
		isLoadingConfig,
		isErrorLoadingConfig,
		saveUserConfig,
		refetchConfig
	}
}
