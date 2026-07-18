import { useRouter } from 'next/router'
import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { useAuthContext } from '~/auth'
import { useIsClient } from '~/hooks/useIsClient'
import type { AuthModel } from '~/utils/pocketbase'
import type { ArticleDocument } from './types'

export const RESEARCH_ACCESS_REDIRECT_PATH = '/research'

export type ArticlesGateState = 'loading' | 'redirect' | 'authorized'

export function resolveArticlesGateState({
	isClient,
	isLoading,
	hasAccess
}: {
	isClient: boolean
	isLoading: boolean
	hasAccess: boolean
}): ArticlesGateState {
	if (!isClient || isLoading) return 'loading'
	return hasAccess ? 'authorized' : 'redirect'
}

export function isResearcher(user: AuthModel | null | undefined): boolean {
	return user?.flags?.is_researcher === true
}

export function hasResearchAccess(user: AuthModel | null | undefined): boolean {
	return isResearcher(user)
}

export function canManageResearchArticle(article: { viewerRole?: ArticleDocument['viewerRole'] }): boolean {
	return article.viewerRole === 'owner' || article.viewerRole === 'researcher'
}

export function canEditResearchArticle({
	article: _article,
	isAuthenticated,
	user
}: {
	article: { viewerRole?: ArticleDocument['viewerRole'] }
	isAuthenticated: boolean
	user: AuthModel | null | undefined
}): boolean {
	return isAuthenticated && isResearcher(user)
}

export function useHasArticlesAccess() {
	const { user, isAuthenticated, loaders } = useAuthContext()
	return {
		isLoading: loaders.userLoading,
		isAuthenticated,
		hasAccess: isAuthenticated && hasResearchAccess(user)
	}
}

export function ArticlesAccessGate({
	children,
	loadingFallback = null
}: {
	children: ReactNode
	loadingFallback?: ReactNode
}) {
	const { isLoading, hasAccess } = useHasArticlesAccess()
	const isClient = useIsClient()
	const router = useRouter()

	const state = resolveArticlesGateState({ isClient, isLoading, hasAccess })

	useEffect(() => {
		if (state !== 'redirect') return
		void router.replace(RESEARCH_ACCESS_REDIRECT_PATH)
	}, [state, router])

	if (state === 'loading') return <>{loadingFallback}</>
	if (state === 'redirect') return null
	return <>{children}</>
}
