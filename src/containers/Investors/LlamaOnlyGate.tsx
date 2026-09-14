import Router from 'next/router'
import { useEffect, type ReactNode } from 'react'
import { useAuthContext } from '~/auth'
import { useIsClient } from '~/hooks/useIsClient'

export type LlamaOnlyGateState = 'authorized' | 'loading' | 'redirect'

export function resolveLlamaOnlyGateState({
	enabled,
	isClient,
	isLoading,
	isLlama
}: {
	enabled: boolean
	isClient: boolean
	isLoading: boolean
	isLlama: boolean
}): LlamaOnlyGateState {
	if (!enabled || isLlama) return 'authorized'
	return !isClient || isLoading ? 'loading' : 'redirect'
}

export function LlamaOnlyGate({
	enabled,
	redirectTo,
	children
}: {
	enabled: boolean
	redirectTo: string
	children: ReactNode
}) {
	const { user, loaders } = useAuthContext()
	const isClient = useIsClient()
	const state = resolveLlamaOnlyGateState({
		enabled,
		isClient,
		isLoading: loaders.userLoading,
		isLlama: user?.flags?.is_llama === true
	})

	useEffect(() => {
		if (state !== 'redirect') return
		void Router.replace(redirectTo)
	}, [state, redirectTo])

	return state === 'authorized' ? <>{children}</> : null
}
