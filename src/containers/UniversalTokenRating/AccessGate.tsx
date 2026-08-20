import { useRouter } from 'next/router'
import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { useAuthContext } from '~/auth'
import { useIsClient } from '~/hooks/useIsClient'
import type { AuthModel } from '~/utils/pocketbase'

export const UTR_REDIRECT_PATH = '/'

export type UtrGateState = 'loading' | 'redirect' | 'authorized'

export function resolveGateState({
	isClient,
	isLoading,
	hasAccess
}: {
	isClient: boolean
	isLoading: boolean
	hasAccess: boolean
}): UtrGateState {
	if (!isClient || isLoading) return 'loading'
	return hasAccess ? 'authorized' : 'redirect'
}

export function hasUtrAccess(user: AuthModel | null | undefined): boolean {
	return user?.flags?.is_llama === true || user?.flags?.forgd_preview === true
}

export function useHasUtrAccess() {
	const { user, loaders } = useAuthContext()
	return {
		isLoading: loaders.userLoading,
		hasAccess: hasUtrAccess(user)
	}
}

export function UtrAccessGate({
	children,
	loadingFallback = null
}: {
	children: ReactNode
	loadingFallback?: ReactNode
}) {
	const { isLoading, hasAccess } = useHasUtrAccess()
	const isClient = useIsClient()
	const router = useRouter()

	const state = resolveGateState({ isClient, isLoading, hasAccess })

	useEffect(() => {
		if (state !== 'redirect') return
		void router.replace(UTR_REDIRECT_PATH)
	}, [state, router])

	if (state === 'loading') return <>{loadingFallback}</>
	if (state === 'redirect') return null
	return <>{children}</>
}
