import { useQuery } from '@tanstack/react-query'
import { getTopAuthors, TOP_AUTHORS_QUERY_KEY } from '~/containers/Authors/api'
import type { TopAuthorEntry } from '~/containers/Authors/types'

const EMPTY_AUTHORS: Array<TopAuthorEntry> = []

export function useTopAuthors(limit = 12) {
	const { data, isLoading } = useQuery({
		queryKey: [...TOP_AUTHORS_QUERY_KEY, limit],
		queryFn: () => getTopAuthors(limit),
		staleTime: 1000 * 60 * 5,
		retry: 1
	})

	return { authors: data ?? EMPTY_AUTHORS, isLoading }
}
