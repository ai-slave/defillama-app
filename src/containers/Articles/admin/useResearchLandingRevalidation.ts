import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useAuthContext } from '~/auth'
import { revalidateResearchLanding } from '~/containers/Articles/api'

export function useResearchLandingRevalidation() {
	const { authorizedFetch } = useAuthContext()
	const queryClient = useQueryClient()

	return useCallback(() => {
		queryClient.invalidateQueries({ queryKey: ['research-landing'] })
		void revalidateResearchLanding(authorizedFetch).catch((err) => {
			console.error('Failed to revalidate research landing', err)
		})
	}, [authorizedFetch, queryClient])
}
