import { useRouter } from 'next/router'
import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { useAuthContext } from '~/containers/Subscription/auth'
import { useIsClient } from '~/hooks/useIsClient'
import type { AuthModel } from '~/utils/pocketbase'

export const FORGD_PREVIEW_REDIRECT_PATH = '/'

export type ForgdGateState = 'loading' | 'redirect' | 'authorized'

export function resolveGateState({
	isClient,
	isLoading,
	hasAccess
}: {
	isClient: boolean
	isLoading: boolean
	hasAccess: boolean
}): ForgdGateState {
	if (!isClient || isLoading) return 'loading'
	return hasAccess ? 'authorized' : 'redirect'
}

export function hasForgdPreview(user: AuthModel | null | undefined): boolean {
	return user?.flags?.forgd_preview === true || user?.flags?.is_llama === true
}

export function useHasForgdPreviewAccess() {
	const { user, loaders } = useAuthContext()
	return {
		isLoading: loaders.userLoading,
		hasAccess: hasForgdPreview(user)
	}
}

export function MarketMakersAccessGate({
	children,
	loadingFallback = null
}: {
	children: ReactNode
	loadingFallback?: ReactNode
}) {
	const { isLoading, hasAccess } = useHasForgdPreviewAccess()
	const isClient = useIsClient()
	const router = useRouter()

	const state = resolveGateState({ isClient, isLoading, hasAccess })

	useEffect(() => {
		if (state !== 'redirect') return
		void router.replace(FORGD_PREVIEW_REDIRECT_PATH)
	}, [state, router])

	if (state === 'loading') return <>{loadingFallback}</>
	if (state === 'redirect') return null
	return <>{children}</>
}
