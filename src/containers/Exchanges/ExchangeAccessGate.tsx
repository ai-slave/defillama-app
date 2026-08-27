import type { ReactNode } from 'react'
import { useAuthContext } from '~/auth'
import { NotFoundPage } from '~/components/NotFoundPage'
import { useIsClient } from '~/hooks/useIsClient'

export type ExchangeAccessState = 'loading' | 'authorized' | 'not-found'

export function resolveExchangeAccessState({
	isClient,
	isLoading,
	isAuthenticated,
	isLlama
}: {
	isClient: boolean
	isLoading: boolean
	isAuthenticated: boolean
	isLlama: boolean
}): ExchangeAccessState {
	if (!isClient || isLoading) return 'loading'
	return isAuthenticated && isLlama ? 'authorized' : 'not-found'
}

export function useExchangeAccessState(): ExchangeAccessState {
	const { isAuthenticated, loaders, user } = useAuthContext()
	const isClient = useIsClient()
	return resolveExchangeAccessState({
		isClient,
		isLoading: loaders.userLoading,
		isAuthenticated,
		isLlama: user?.flags?.is_llama === true
	})
}

export function ExchangeAccessGate({ children }: { children: ReactNode }) {
	const state = useExchangeAccessState()

	if (state === 'loading') return null
	if (state === 'not-found') return <NotFoundPage />
	return <>{children}</>
}

// For exchange-sourced widgets embedded in public pages (e.g. the token page depth
// chart): hides the children for non-llama users instead of 404ing the whole page.
export function ExchangeFeatureGate({ children }: { children: ReactNode }) {
	const state = useExchangeAccessState()

	return state === 'authorized' ? <>{children}</> : null
}
