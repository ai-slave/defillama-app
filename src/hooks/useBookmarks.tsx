import { useIsFetching } from '@tanstack/react-query'
import { useWatchlistManager } from '~/contexts/LocalStorage'
import { USER_CONFIG_QUERY_KEY } from './useUserConfig'

export function useBookmarks(type: 'defi' | 'yields' | 'chains' | 'tokens') {
	const watchlist = useWatchlistManager(type)
	const loadingConfig = useIsFetching({
		queryKey: USER_CONFIG_QUERY_KEY,
		predicate: (query) => query.state.data === undefined
	})
	// UserSettingsSync owns persistence for every local settings change, including bookmarks.
	return { ...watchlist, isLoadingWatchlist: loadingConfig > 0 }
}
