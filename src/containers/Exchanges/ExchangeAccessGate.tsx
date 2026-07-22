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

export function ExchangeAccessGate({ children }: { children: ReactNode }) {
	const { isAuthenticated, loaders, user } = useAuthContext()
	const isClient = useIsClient()
	const state = resolveExchangeAccessState({
		isClient,
		isLoading: loaders.userLoading,
		isAuthenticated,
		isLlama: user?.flags?.is_llama === true
	})

	if (state === 'loading') return null
	if (state === 'not-found') return <NotFoundPage />
	return <>{children}</>
}
